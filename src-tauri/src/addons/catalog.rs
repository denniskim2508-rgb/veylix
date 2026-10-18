use super::models::AddonCatalog;

pub async fn fetch_catalog(url: &str) -> Result<AddonCatalog, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .header("User-Agent", "GameHub/0.1")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/json")
        .to_string();

    if !content_type.contains("json") && !content_type.contains("text") {
        return Err(format!("Unexpected content type: {}", content_type));
    }

    let text = response.text().await.map_err(|e| e.to_string())?;
    let catalog: AddonCatalog =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse catalog: {}", e))?;

    Ok(catalog)
}

pub fn load_local_catalog(path: &str) -> Result<AddonCatalog, String> {
    let content = std::fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let catalog: AddonCatalog =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse catalog: {}", e))?;
    Ok(catalog)
}
