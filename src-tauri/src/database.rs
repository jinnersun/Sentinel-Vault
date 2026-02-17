use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use once_cell::sync::OnceCell;

static DB_POOL: OnceCell<SqlitePool> = OnceCell::new();

// 迁移文件
const MIGRATION_001: &str = include_str!("../migrations/001_init_database.sql");
const MIGRATION_002: &str = include_str!("../migrations/002_add_domain_certificate_tables.sql");

pub async fn init_database() -> Result<(), sqlx::Error> {
    let database_url = "sqlite:./devvault.db";
    
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);
    
    let pool = SqlitePool::connect_with(options).await?;

    // 应用迁移（创建所有表）
    apply_migrations(&pool).await?;

    // Store the pool in the global
    let _ = DB_POOL.set(pool);
    Ok(())
}

async fn apply_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // 迁移跟踪表
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )"#
    )
    .execute(pool)
    .await?;

    // 应用 001 迁移
    apply_migration(pool, "001_init_database.sql", MIGRATION_001).await?;
    
    // 应用 002 迁移
    apply_migration(pool, "002_add_domain_certificate_tables.sql", MIGRATION_002).await?;

    Ok(())
}

async fn apply_migration(pool: &SqlitePool, name: &str, sql: &str) -> Result<(), sqlx::Error> {
    let applied: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _migrations WHERE name = ?")
        .bind(name)
        .fetch_one(pool)
        .await?;

    if applied == 0 {
        // 执行迁移文件（按分号分割语句）
        for stmt in sql.split(';') {
            let s = stmt.trim();
            if s.is_empty() {
                continue;
            }
            sqlx::query(s).execute(pool).await?;
        }

        // 记录迁移已应用
        sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
            .bind(name)
            .execute(pool)
            .await?;
    }

    Ok(())
}

pub async fn get_db_pool() -> Result<SqlitePool, String> {
    DB_POOL
        .get()
        .cloned()
        .ok_or_else(|| "Database not initialized".to_string())
}