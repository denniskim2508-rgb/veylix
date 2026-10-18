#Requires -Version 5.1
<#
.SYNOPSIS
    Builds, signs and stages a Veylix release for GitHub Releases.

.DESCRIPTION
    Produces the NSIS installer and its updater signature, writes the
    latest.json manifest the updater polls, and stages everything in release/.

    Run once with -GenerateKey to create the signing keypair and patch
    tauri.conf.json with the public key, then without it for every release.
    The GitHub repo slug is read from the updater endpoint in tauri.conf.json
    unless -GithubRepo is passed explicitly.

.EXAMPLE
    .\scripts\release.ps1 -GenerateKey
    .\scripts\release.ps1
    .\scripts\release.ps1 -Notes "Fixes crash on launch"
#>
[CmdletBinding()]
param(
    [string]$GithubRepo,

    [string]$Notes = "",
    [string]$Tag,
    [string]$KeyPath = (Join-Path $env:USERPROFILE ".tauri\veylix.key"),
    [switch]$GenerateKey,
    [switch]$Upload
)

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$confPath = Join-Path $root "src-tauri\tauri.conf.json"
$cargoPath = Join-Path $root "src-tauri\Cargo.toml"
$pkgPath = Join-Path $root "package.json"
$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$outDir = Join-Path $root "release"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

function Read-KeyPassword {
    $sec = Read-Host "Signing key password (press Enter if the key has none)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

# --- 1. Version parity -------------------------------------------------------
Write-Step "Checking version parity"
$confText = Get-Content $confPath -Raw
$confVer = ($confText | ConvertFrom-Json).version
$pkgVer = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
$cargoVer = (Select-String -Path $cargoPath -Pattern '^version\s*=\s*"([^"]+)"' |
    Select-Object -First 1).Matches[0].Groups[1].Value

if ($confVer -ne $pkgVer -or $confVer -ne $cargoVer) {
    throw "Version mismatch: tauri.conf.json=$confVer package.json=$pkgVer Cargo.toml=$cargoVer"
}
$version = $confVer
if (-not $Tag) { $Tag = "v$version" }

# Repo slug defaults to whatever the updater endpoint in tauri.conf.json points at
if (-not $GithubRepo) {
    $slug = [regex]::Match($confText, 'github\.com/([^/]+/[^/]+)/releases')
    if ($slug.Success) { $GithubRepo = $slug.Groups[1].Value }
}
if (-not $GithubRepo -or $GithubRepo -eq 'OWNER/REPO') {
    throw "GithubRepo not set. Pass -GithubRepo owner/repo, or set the updater endpoint in tauri.conf.json."
}

$endpoint = "https://github.com/$GithubRepo/releases/latest/download/latest.json"
Write-Host "    version $version  tag $Tag  repo $GithubRepo"

# --- 2. Signing key ----------------------------------------------------------
if ($GenerateKey) {
    if (Test-Path $KeyPath) {
        Write-Host "    key already exists at $KeyPath (leaving it alone)"
    } else {
        Write-Step "Generating signing key at $KeyPath"
        New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
        npx tauri signer generate -w $KeyPath
        if ($LASTEXITCODE -ne 0) { throw "tauri signer generate failed" }
    }
    $pubPath = "$KeyPath.pub"
    if (-not (Test-Path $pubPath)) { throw "Public key not found at $pubPath" }
    Write-Step "Patching pubkey + endpoint in tauri.conf.json"
    $pub = (Get-Content $pubPath -Raw).Trim()
    $confText = [regex]::Replace($confText, '("pubkey"\s*:\s*")[^"]*(")',
        { param($m) $m.Groups[1].Value + $pub + $m.Groups[2].Value })
    $confText = [regex]::Replace($confText, '("endpoints"\s*:\s*\[\s*")[^"]*(")',
        { param($m) $m.Groups[1].Value + $endpoint + $m.Groups[2].Value })
    Set-Content -LiteralPath $confPath -Value $confText -NoNewline
    Write-Host "    pubkey and endpoint written"
}

if (-not (Test-Path $KeyPath)) {
    throw "Signing key missing at $KeyPath. Re-run with -GenerateKey once."
}

# --- 3. Build ----------------------------------------------------------------
Write-Step "Building (frontend via beforeBuildCommand, NSIS bundle + updater signature)"
$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path $KeyPath).Path
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Read-KeyPassword
}
npx tauri build
if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }

# --- 4. Collect artifacts ----------------------------------------------------
Write-Step "Collecting bundle artifacts"
$exe = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" | Select-Object -First 1
if (-not $exe) { throw "No *-setup.exe found under $nsisDir" }
$sig = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe.sig" | Select-Object -First 1
if (-not $sig) {
    throw "No *.exe.sig found. Is TAURI_SIGNING_PRIVATE_KEY set and createUpdaterArtifacts true?"
}
$signature = (Get-Content $sig.FullName -Raw).Trim()

# --- 5. latest.json ----------------------------------------------------------
Write-Step "Writing latest.json"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$manifest = [ordered]@{
    version   = $version
    notes     = $Notes
    pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $signature
            url       = "https://github.com/$GithubRepo/releases/download/$Tag/$($exe.Name)"
        }
    }
}
$manifestPath = Join-Path $outDir "latest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Copy-Item $exe.FullName (Join-Path $outDir $exe.Name) -Force
Copy-Item $sig.FullName (Join-Path $outDir $sig.Name) -Force

Write-Host ""
Write-Host "Staged in $outDir :" -ForegroundColor Green
Get-ChildItem $outDir | ForEach-Object { Write-Host "  $($_.Name)" }

# --- 6. Publish --------------------------------------------------------------
$assets = @(
    (Join-Path $outDir $exe.Name),
    (Join-Path $outDir $sig.Name),
    $manifestPath
)
$hasGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)
$ghOk = $false
if ($hasGh) { gh auth status 2>$null; $ghOk = $LASTEXITCODE -eq 0 }

if ($Upload -and $ghOk) {
    Write-Step "Creating GitHub release $Tag"
    gh release create $Tag --repo $GithubRepo --title "Veylix $Tag" --notes $Notes @assets
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
    Write-Host "Release $Tag published." -ForegroundColor Green
} else {
    if ($Upload -and -not $hasGh) { Write-Warning "gh not found — falling back to manual upload steps." }
    if ($Upload -and $hasGh -and -not $ghOk) { Write-Warning "gh is not authenticated — falling back to manual upload steps." }
    Write-Host ""
    Write-Host "Manual upload (create the release FIRST, marked as 'latest'):" -ForegroundColor Yellow
    Write-Host "  1. https://github.com/$GithubRepo/releases/new  ->  tag: $Tag"
    Write-Host "  2. Upload these three files as release assets:"
    Write-Host "       $($exe.Name)"
    Write-Host "       $($sig.Name)"
    Write-Host "       latest.json"
    Write-Host "  3. Publish. The app polls:"
    Write-Host "       $endpoint"
}
