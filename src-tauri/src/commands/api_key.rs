use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: Option<i64>,
    pub name: String,
    pub key_value: String,
    pub owner_id: Option<i64>,
    pub scope: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[command]
pub async fn create_api_key(api_key: ApiKey) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let result = sqlx::query(
        "INSERT INTO api_keys_registry (name, key_value, owner_id, scope) VALUES (?, ?, ?, ?)"
    )
    .bind(&api_key.name)
    .bind(&api_key.key_value)
    .bind(api_key.owner_id)
    .bind(&api_key.scope)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(result.last_insert_rowid())
}

#[command]
pub async fn get_api_keys() -> Result<Vec<ApiKey>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT id, name, key_value, owner_id, scope, created_at, updated_at FROM api_keys_registry ORDER BY created_at DESC")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let api_keys: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(ApiKey {
            id: Some(row.get("id")),
            name: row.get("name"),
            key_value: row.get("key_value"),
            owner_id: row.get("owner_id"),
            scope: row.get("scope"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }).collect();

    api_keys
}

#[command]
pub async fn update_api_key(id: i64, api_key: ApiKey) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE api_keys_registry SET name = ?, key_value = ?, owner_id = ?, scope = ? WHERE id = ?")
        .bind(&api_key.name)
        .bind(&api_key.key_value)
        .bind(api_key.owner_id)
        .bind(&api_key.scope)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn delete_api_key(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM api_keys_registry WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
