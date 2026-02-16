use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use once_cell::sync::OnceCell;

static DB_POOL: OnceCell<SqlitePool> = OnceCell::new();

const MIGRATION_001: &str = include_str!("../migrations/001_create_projects_table.sql");
const MIGRATION_002: &str = include_str!("../migrations/002_create_relations_table.sql");
const MIGRATION_003: &str = include_str!("../migrations/003_create_imports_table.sql");
const MIGRATION_004: &str = include_str!("../migrations/004_create_api_keys_table.sql");
const MIGRATION_005: &str = include_str!("../migrations/005_migrate_vault_relations.sql");
const MIGRATION_006: &str = include_str!("../migrations/006_create_vault_history.sql");
const MIGRATION_007: &str = include_str!("../migrations/007_create_import_logs.sql");
const MIGRATION_008: &str = include_str!("../migrations/008_alter_projects_table.sql");

pub async fn init_database() -> Result<(), sqlx::Error> {
    let database_url = "sqlite:./devvault.db";
    
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);
    
    let pool = SqlitePool::connect_with(options).await?;

    // Ensure base tables that older versions expect
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

    // Apply V2 migrations (idempotent)
    apply_migrations(&pool).await?;

    // Insert default project if none exists
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
        .fetch_one(&pool)
        .await?;
        
    if count == 0 {
        sqlx::query("INSERT INTO projects (name, color) VALUES (?, ?)")
            .bind("Default")
            .bind("#10b981")
            .execute(&pool)
            .await?;
    }

    // Store the pool in the global
    let _ = DB_POOL.set(pool);
    Ok(())
}

async fn apply_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // migrations tracking table
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )"#
    )
    .execute(pool)
    .await?;

    let migrations: &[(&str, &str)] = &[
        ("001_create_projects_table.sql", MIGRATION_001),
        ("002_create_relations_table.sql", MIGRATION_002),
        ("003_create_imports_table.sql", MIGRATION_003),
        ("004_create_api_keys_table.sql", MIGRATION_004),
        ("005_migrate_vault_relations.sql", MIGRATION_005),
        ("006_create_vault_history.sql", MIGRATION_006),
        ("007_create_import_logs.sql", MIGRATION_007),
        ("008_alter_projects_table.sql", MIGRATION_008),
    ];

    for (name, sql) in migrations.iter() {
        let applied: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _migrations WHERE name = ?")
            .bind(name)
            .fetch_one(pool)
            .await?;

        if applied == 0 {
            // Split by semicolon to run multiple statements safely
            for stmt in sql.split(';') {
                let s = stmt.trim();
                if s.is_empty() {
                    continue;
                }
                sqlx::query(s).execute(pool).await?;
            }

            sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
                .bind(name)
                .execute(pool)
                .await?;
        }
    }

    Ok(())
}

pub async fn get_db_pool() -> Result<SqlitePool, String> {
    DB_POOL
        .get()
        .cloned()
        .ok_or_else(|| "Database not initialized".to_string())
}