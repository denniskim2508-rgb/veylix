use rusqlite::{Connection, Result};
use std::sync::Mutex;
use once_cell::sync::Lazy;

static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn init_db() -> Result<()> {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("gamehub");

    std::fs::create_dir_all(&app_dir).ok();
    std::fs::create_dir_all(app_dir.join("artwork")).ok();

    let db_path = app_dir.join("gamehub.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            platform TEXT NOT NULL,
            install_path TEXT,
            executable_path TEXT,
            cover_image TEXT,
            background_image TEXT,
            description TEXT,
            release_date TEXT,
            genre TEXT,
            developer TEXT,
            publisher TEXT,
            play_time INTEGER DEFAULT 0,
            last_played TEXT,
            is_installed BOOLEAN DEFAULT 0,
            is_favorite BOOLEAN DEFAULT 0,
            platform_game_id TEXT,
            launch_command TEXT,
            drive_letter TEXT,
            trailer_path TEXT,
            trailer_source TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS play_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_minutes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_screenshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            local_path TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS drives (
            letter TEXT PRIMARY KEY,
            volume_label TEXT,
            drive_type TEXT,
            fs_type TEXT,
            total_bytes INTEGER,
            free_bytes INTEGER,
            last_seen TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT
        );

        CREATE TABLE IF NOT EXISTS game_categories (
            game_id INTEGER REFERENCES games(id),
            category_id INTEGER REFERENCES categories(id),
            PRIMARY KEY (game_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS emulators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            executable_path TEXT NOT NULL,
            platform TEXT NOT NULL,
            command_template TEXT,
            supported_extensions TEXT DEFAULT '',
            default_args TEXT DEFAULT '',
            is_installed BOOLEAN DEFAULT 0,
            icon TEXT
        );

        CREATE TABLE IF NOT EXISTS rom_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            emulator_id INTEGER REFERENCES emulators(id) ON DELETE SET NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS rom_scan_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            label TEXT,
            emulator_id INTEGER REFERENCES emulators(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS plugin_settings (
            plugin_id TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scan_exclusions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT NOT NULL,
            exclusion_type TEXT NOT NULL DEFAULT 'path',
            is_regex BOOLEAN DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS rom_databases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            game_name TEXT NOT NULL,
            description TEXT,
            rom_name TEXT NOT NULL,
            crc32 TEXT NOT NULL,
            rom_size INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_rom_databases_crc32 ON rom_databases(crc32);

        CREATE TABLE IF NOT EXISTS game_external_ids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            external_id TEXT NOT NULL,
            UNIQUE(game_id, provider)
        );
        CREATE INDEX IF NOT EXISTS idx_game_external_ids_game ON game_external_ids(game_id);
        CREATE INDEX IF NOT EXISTS idx_game_external_ids_provider ON game_external_ids(provider, external_id);

        CREATE TABLE IF NOT EXISTS game_artwork (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            artwork_type TEXT NOT NULL,
            url TEXT NOT NULL,
            thumbnail_url TEXT,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            provider TEXT NOT NULL,
            provider_asset_id TEXT,
            score REAL DEFAULT 0.0,
            is_primary BOOLEAN DEFAULT 0,
            selection_mode TEXT DEFAULT 'automatic',
            cached_path TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_game_artwork_game ON game_artwork(game_id);
        CREATE INDEX IF NOT EXISTS idx_game_artwork_type ON game_artwork(artwork_type);
        CREATE INDEX IF NOT EXISTS idx_game_artwork_provider ON game_artwork(provider);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_game_artwork_provider_asset ON game_artwork(provider, provider_asset_id);

        CREATE TABLE IF NOT EXISTS metadata_cache (
            cache_key TEXT PRIMARY KEY,
            response_json TEXT NOT NULL,
            provider TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_metadata_cache_provider ON metadata_cache(provider);

        CREATE TABLE IF NOT EXISTS provider_priorities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            provider TEXT NOT NULL,
            priority_order INTEGER NOT NULL,
            is_enabled BOOLEAN DEFAULT 1,
            UNIQUE(category, provider)
        );

        CREATE TABLE IF NOT EXISTS installed_addons (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            version TEXT NOT NULL,
            author TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            installed_at TEXT NOT NULL,
            updated_at TEXT,
            install_path TEXT NOT NULL,
            source_url TEXT
        );
        "
    )?;

    // Migrations
    let has_developer: bool = conn
        .prepare("SELECT developer FROM games LIMIT 1")
        .is_ok();
    if !has_developer {
        conn.execute_batch("ALTER TABLE games ADD COLUMN developer TEXT;").ok();
        conn.execute_batch("ALTER TABLE games ADD COLUMN publisher TEXT;").ok();
    }

    let has_extensions: bool = conn
        .prepare("SELECT supported_extensions FROM emulators LIMIT 1")
        .is_ok();
    if !has_extensions {
        conn.execute_batch("ALTER TABLE emulators ADD COLUMN supported_extensions TEXT DEFAULT '';").ok();
        conn.execute_batch("ALTER TABLE emulators ADD COLUMN default_args TEXT DEFAULT '';").ok();
        conn.execute_batch("ALTER TABLE emulators ADD COLUMN is_installed BOOLEAN DEFAULT 0;").ok();
        conn.execute_batch("ALTER TABLE emulators ADD COLUMN icon TEXT;").ok();
    }

    let has_core_path: bool = conn
        .prepare("SELECT core_path FROM emulators LIMIT 1")
        .is_ok();
    if !has_core_path {
        conn.execute_batch("ALTER TABLE emulators ADD COLUMN core_path TEXT;").ok();
    }

    let has_override: bool = conn
        .prepare("SELECT override_emulator_id FROM games LIMIT 1")
        .is_ok();
    if !has_override {
        conn.execute_batch("ALTER TABLE games ADD COLUMN override_emulator_id INTEGER;").ok();
    }

    let has_icon: bool = conn
        .prepare("SELECT icon FROM games LIMIT 1")
        .is_ok();
    if !has_icon {
        conn.execute_batch("ALTER TABLE games ADD COLUMN icon TEXT;").ok();
        conn.execute_batch("ALTER TABLE games ADD COLUMN logo TEXT;").ok();
    }

    let has_trailer: bool = conn
        .prepare("SELECT trailer_path FROM games LIMIT 1")
        .is_ok();
    if !has_trailer {
        conn.execute_batch("ALTER TABLE games ADD COLUMN trailer_path TEXT;").ok();
        conn.execute_batch("ALTER TABLE games ADD COLUMN trailer_source TEXT;").ok();
    }

    *DB.lock().unwrap() = Some(conn);
    Ok(())
}

pub fn get_db() -> std::sync::MutexGuard<'static, Option<Connection>> {
    DB.lock().unwrap()
}
