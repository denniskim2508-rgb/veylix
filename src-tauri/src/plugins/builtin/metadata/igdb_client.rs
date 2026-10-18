use crate::library::ArtworkSearchResult;
use crate::plugins::settings;

pub struct IgdbClient {
    client_id: String,
    client_secret: String,
    access_token: Option<String>,
}

impl std::fmt::Debug for IgdbClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("IgdbClient")
            .field("client_id", &self.client_id)
            .field("client_secret", &"[REDACTED]")
            .field("has_token", &self.access_token.is_some())
            .finish()
    }
}

impl IgdbClient {
    pub fn from_settings() -> Option<Self> {
        let plugin_settings = settings::load_plugin_settings("igdb");
        let client_id = plugin_settings.get("client_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let client_secret = plugin_settings.get("client_secret")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if client_id.is_empty() || client_secret.is_empty() {
            return None;
        }

        Some(Self {
            client_id,
            client_secret,
            access_token: None,
        })
    }

    pub fn is_configured() -> bool {
        let plugin_settings = settings::load_plugin_settings("igdb");
        let client_id = plugin_settings.get("client_id")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let client_secret = plugin_settings.get("client_secret")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        !client_id.is_empty() && !client_secret.is_empty()
    }

    pub async fn authenticate(&mut self) -> Result<(), String> {
        let url = "https://id.twitch.tv/oauth2/token";
        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("grant_type", "client_credentials"),
        ];

        let client = reqwest::Client::new();
        let resp = client.post(url)
            .form(&params)
            .send()
            .await
            .map_err(|_| "Authentication request failed. Check your internet connection.".to_string())?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 401 {
                return Err("Invalid IGDB credentials. Check your Client ID and Client Secret.".to_string());
            }
            return Err(format!("IGDB authentication failed (HTTP {})", status));
        }

        let body: serde_json::Value = resp.json().await
            .map_err(|_| "Failed to parse authentication response.".to_string())?;

        if let Some(token) = body["access_token"].as_str() {
            self.access_token = Some(token.to_string());
            Ok(())
        } else {
            Err("Authentication succeeded but no access token was received.".to_string())
        }
    }

    pub async fn test_connection(&mut self) -> Result<String, String> {
        self.authenticate().await?;

        let token = self.access_token.as_ref().ok_or("Authentication failed")?;

        let body = "fields name; limit 1;";

        let client = reqwest::Client::new();
        let resp = client.post("https://api.igdb.com/v4/games")
            .header("Client-ID", &self.client_id)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "text/plain")
            .body(body)
            .send()
            .await
            .map_err(|_| "IGDB API request failed. Check your internet connection.".to_string())?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(format!("IGDB API error (HTTP {}). Your credentials may be invalid.", status));
        }

        Ok("Connected to IGDB successfully".to_string())
    }

    pub async fn search_artwork(&mut self, query: &str, artwork_type: &str) -> Result<Vec<ArtworkSearchResult>, String> {
        if self.access_token.is_none() {
            self.authenticate().await?;
        }

        let token = self.access_token.as_ref()
            .ok_or("Not authenticated. Please configure IGDB credentials in Settings > Metadata Providers.")?;

        let fields = match artwork_type {
            "cover" => "name,cover.image_id,cover.width,cover.height",
            "background" => "name,artworks.image_id,artworks.width,artworks.height",
            "icon" => "name,screenshots.image_id,screenshots.width,screenshots.height",
            "logo" => "name,artworks.image_id,artworks.width,artworks.height",
            "screenshot" => "name,screenshots.image_id,screenshots.width,screenshots.height",
            _ => "name,cover.image_id,cover.width,cover.height",
        };

        let body = format!("search \"{}\"; fields {},id; limit 10;", query, fields);

        let client = reqwest::Client::new();
        let resp = client.post("https://api.igdb.com/v4/games")
            .header("Client-ID", &self.client_id)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "text/plain")
            .body(body)
            .send()
            .await
            .map_err(|_| "Search request failed. Check your internet connection.".to_string())?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 401 {
                return Err("IGDB session expired. Please reconfigure credentials in Settings > Metadata Providers.".to_string());
            }
            return Err(format!("IGDB search failed (HTTP {})", status));
        }

        let games: Vec<serde_json::Value> = resp.json().await.map_err(|_| "Failed to parse IGDB search response.".to_string())?;
        let mut results = Vec::new();

        for game in &games {
            let game_name = game["name"].as_str().unwrap_or("Unknown");

            match artwork_type {
                "cover" => {
                    if let Some(cover) = game.get("cover") {
                        if let Some(image_id) = cover["image_id"].as_str() {
                            let width = cover["width"].as_u64().unwrap_or(0) as u32;
                            let height = cover["height"].as_u64().unwrap_or(0) as u32;
                            results.push(ArtworkSearchResult {
                                title: game_name.to_string(),
                                source_url: igdb_image_url(image_id, "cover_big"),
                                thumbnail_url: igdb_image_url(image_id, "cover_small"),
                                width,
                                height,
                                provider: "IGDB".to_string(),
                            });
                        }
                    }
                }
                "screenshot" | "icon" => {
                    if let Some(ss) = game.get("screenshots") {
                        if let Some(arr) = ss.as_array() {
                            for s in arr.iter().take(5) {
                                if let Some(image_id) = s["image_id"].as_str() {
                                    let width = s["width"].as_u64().unwrap_or(0) as u32;
                                    let height = s["height"].as_u64().unwrap_or(0) as u32;
                                    results.push(ArtworkSearchResult {
                                        title: game_name.to_string(),
                                        source_url: igdb_image_url(image_id, "screenshot_huge"),
                                        thumbnail_url: igdb_image_url(image_id, "screenshot_med"),
                                        width,
                                        height,
                                        provider: "IGDB".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                "background" | "logo" => {
                    if let Some(artworks) = game.get("artworks") {
                        if let Some(arr) = artworks.as_array() {
                            for a in arr.iter().take(5) {
                                if let Some(image_id) = a["image_id"].as_str() {
                                    let width = a["width"].as_u64().unwrap_or(0) as u32;
                                    let height = a["height"].as_u64().unwrap_or(0) as u32;
                                    results.push(ArtworkSearchResult {
                                        title: game_name.to_string(),
                                        source_url: igdb_image_url(image_id, "1080p"),
                                        thumbnail_url: igdb_image_url(image_id, "720p"),
                                        width,
                                        height,
                                        provider: "IGDB".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(results)
    }
}

fn igdb_image_url(image_id: &str, size: &str) -> String {
    format!("https://images.igdb.com/igdb/image/upload/t_{}/{}.jpg", size, image_id)
}
