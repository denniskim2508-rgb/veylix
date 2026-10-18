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
    [string]$KeyPassword,
    [switch]$GenerateKey,
    [switch]$SkipBuild,
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
    Write-Host "Enter the signing key password (press Enter for none)." -ForegroundColor Yellow
    Write-Host "Input is hidden - nothing appears as you type, that is normal." -ForegroundColor DarkGray
    $sec = Read-Host "Password" -AsSecureString
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
$conf = $confText | ConvertFrom-Json
$confVer = $conf.version
$productName = $conf.productName
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
# Resolve the password once, in PowerShell. The CLI's own prompt (dialoguer)
# reads the console in raw mode and silently swallows input when run from a
# script, so we never let it prompt - we hand the value over with -p instead.
# Only needed when we actually touch the key (generate) or sign a build.
$needsPassword = $GenerateKey -or (-not $SkipBuild)
$pw = $KeyPassword
if ($needsPassword -and -not $pw) { $pw = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD }
if ($needsPassword -and -not $pw) { $pw = Read-KeyPassword }

if ($GenerateKey) {
    if (Test-Path $KeyPath) {
        Write-Host "    key already exists at $KeyPath (leaving it alone)"
    } else {
        Write-Step "Generating signing key at $KeyPath"
        New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
        if ([string]::IsNullOrEmpty($pw)) {
            npx tauri signer generate -w $KeyPath --ci
        } else {
            npx tauri signer generate -w $KeyPath -p $pw
        }
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
# Purge stale output first: an old differently-named installer left in the
# bundle dir is exactly what silently shipped the wrong binary once already.
Write-Step "Cleaning previous output"
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }

if ($SkipBuild) {
    Write-Step "Skipping build (-SkipBuild) - re-staging existing artifacts"
} else {
    # Purge stale bundle output: an old, differently-named installer left here is
    # exactly what silently shipped the wrong binary once already.
    if (Test-Path $nsisDir) {
        Get-ChildItem -Path $nsisDir -Filter "*-setup.exe*" -File -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
    Write-Step "Building (frontend via beforeBuildCommand, NSIS bundle + updater signature)"
    $env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path $KeyPath).Path
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $pw
    npx tauri build
    if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }
}

# --- 4. Collect artifacts ----------------------------------------------------
Write-Step "Collecting bundle artifacts"
$arch = if ($env:CARGO_BUILD_TARGET -match 'aarch64') { 'arm64' } else { 'x64' }
$expected = "$($productName)_$($version)_$($arch)-setup.exe"
$exe = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" -File |
    Where-Object { $_.Name -eq $expected } | Select-Object -First 1
if (-not $exe) {
    $exe = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($exe) { Write-Warning "Expected '$expected' not found; using newest instead: $($exe.Name)" }
}
if (-not $exe) { throw "No *-setup.exe found under $nsisDir" }

$sigPath = Join-Path $nsisDir "$($exe.Name).sig"
if (-not (Test-Path $sigPath)) {
    throw "No signature for $($exe.Name). Is TAURI_SIGNING_PRIVATE_KEY set and createUpdaterArtifacts true?"
}
$signature = (Get-Content $sigPath -Raw).Trim()

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
Copy-Item $sigPath (Join-Path $outDir "$($exe.Name).sig") -Force

Write-Host ""
Write-Host "Staged in $outDir :" -ForegroundColor Green
Get-ChildItem $outDir | ForEach-Object { Write-Host "  $($_.Name)" }

# --- 6. Publish --------------------------------------------------------------
$assets = @(
    (Join-Path $outDir $exe.Name),
    (Join-Path $outDir "$($exe.Name).sig"),
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
    Write-Host "       $($exe.Name).sig"
    Write-Host "       latest.json"
    Write-Host "  3. Publish. The app polls:"
    Write-Host "       $endpoint"
}
