use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: Option<i64>,
    pub title: String,
    pub secret_encrypted: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: String,
    pub project_id: Option<i64>,
    pub color: String,
    pub favicon_url: Option<String>,
    pub is_archived: bool,
    // 安全相关字段
    pub last_rotated_at: Option<String>,
    pub enable_rotation_reminder: Option<bool>,
    pub rotation_reminder_days: Option<i32>,
    pub api_expires_at: Option<String>,
    pub enable_expiry_alert: Option<bool>,
    pub expiry_alert_days: Option<i32>,
}

#[command]
pub async fn create_vault_item(item: VaultItem) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let result = sqlx::query(
        r#"
        INSERT INTO vault (title, secret_encrypted, url, notes, category, project_id, color, favicon_url, is_archived)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&item.title)
    .bind(&item.secret_encrypted)
    .bind(&item.url)
    .bind(&item.notes)
    .bind(&item.category)
    .bind(&item.project_id)
    .bind(&item.color)
    .bind(&item.favicon_url)
    .bind(item.is_archived as i32)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result.last_insert_rowid())
}

#[command]
pub async fn get_vault_items() -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, title, secret_encrypted, url, notes, category, project_id, color, favicon_url, is_archived,
               last_rotated_at, enable_rotation_reminder, rotation_reminder_days,
               api_expires_at, enable_expiry_alert, expiry_alert_days
        FROM vault
        WHERE is_archived = 0
        ORDER BY last_modified DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let items: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(VaultItem {
            id: Some(row.get("id")),
            title: row.get("title"),
            secret_encrypted: row.get("secret_encrypted"),
            url: row.get("url"),
            notes: row.get("notes"),
            category: row.get("category"),
            project_id: row.get("project_id"),
            color: row.get("color"),
            favicon_url: row.get("favicon_url"),
            is_archived: row.get::<i32, _>("is_archived") != 0,
            last_rotated_at: row.get("last_rotated_at"),
            enable_rotation_reminder: row.get::<Option<i32>, _>("enable_rotation_reminder").map(|v| v != 0),
            rotation_reminder_days: row.get("rotation_reminder_days"),
            api_expires_at: row.get("api_expires_at"),
            enable_expiry_alert: row.get::<Option<i32>, _>("enable_expiry_alert").map(|v| v != 0),
            expiry_alert_days: row.get("expiry_alert_days"),
        })
    }).collect();
    
    items
}

#[command]
pub async fn update_vault_item(id: i64, item: VaultItem) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query(
        r#"
        UPDATE vault 
        SET title = ?, secret_encrypted = ?, url = ?, notes = ?, category = ?, project_id = ?, color = ?, favicon_url = ?, last_modified = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(&item.title)
    .bind(&item.secret_encrypted)
    .bind(&item.url)
    .bind(&item.notes)
    .bind(&item.category)
    .bind(&item.project_id)
    .bind(&item.color)
    .bind(&item.favicon_url)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn delete_vault_item(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query("UPDATE vault SET is_archived = 1 WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn search_items(query: String) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, title, secret_encrypted, url, notes, category, project_id, color, favicon_url, is_archived,
               last_rotated_at, enable_rotation_reminder, rotation_reminder_days,
               api_expires_at, enable_expiry_alert, expiry_alert_days
        FROM vault
        WHERE is_archived = 0 
        AND (title LIKE ? OR notes LIKE ? OR url LIKE ?)
        ORDER BY last_modified DESC
        "#
    )
    .bind(format!("%{}%", query))
    .bind(format!("%{}%", query))
    .bind(format!("%{}%", query))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let items: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(VaultItem {
            id: Some(row.get("id")),
            title: row.get("title"),
            secret_encrypted: row.get("secret_encrypted"),
            url: row.get("url"),
            notes: row.get("notes"),
            category: row.get("category"),
            project_id: row.get("project_id"),
            color: row.get("color"),
            favicon_url: row.get("favicon_url"),
            is_archived: row.get::<i32, _>("is_archived") != 0,
            last_rotated_at: row.get("last_rotated_at"),
            enable_rotation_reminder: row.get::<Option<i32>, _>("enable_rotation_reminder").map(|v| v != 0),
            rotation_reminder_days: row.get("rotation_reminder_days"),
            api_expires_at: row.get("api_expires_at"),
            enable_expiry_alert: row.get::<Option<i32>, _>("enable_expiry_alert").map(|v| v != 0),
            expiry_alert_days: row.get("expiry_alert_days"),
        })
    }).collect();
    
    items
}
