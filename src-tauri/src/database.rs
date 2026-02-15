use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use once_cell::sync::OnceCell;

static DB_POOL: OnceCell<SqlitePool> = OnceCell::new();

pub async fn init_database() -> Result<(), sqlx::Error> {
    let database_url = "sqlite:./devvault.db";
    
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);
    
    let pool = SqlitePool::connect_with(options).await?;
    
    // Create tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vault (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            secret_encrypted TEXT NOT NULL,
            url TEXT,
            notes TEXT,
            category TEXT DEFAULT 'API',
            project_id INTEGER,
            color TEXT DEFAULT '#3b82f6',
            favicon_url TEXT,
            is_archived INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
        "#
    )
    .execute(&pool)
    .await?;
    
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT '#10b981'
        )
        "#
    )
    .execute(&pool)
    .await?;
    
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#
    )
    .execute(&pool)
    .await?;

    // Insert default project if none exists
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
        .fetch_one(&pool)
        .await?;
        
    if count == 0 {
        sqlx::query("INSERT INTO projects (name, color) VALUES (?, ?)")
            .bind("默认项目")
            .bind("#10b981")
            .execute(&pool)
            .await?;
    }

    // Store the pool in the global
    let _ = DB_POOL.set(pool);
    Ok(())
}

pub async fn get_db_pool() -> Result<SqlitePool, String> {
    DB_POOL
        .get()
        .cloned()
        .ok_or_else(|| "Database not initialized".to_string())
}