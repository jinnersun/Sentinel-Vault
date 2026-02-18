use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;
use crate::commands::vault::{VaultItem};

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialProjectRelation {
    pub id: Option<i64>,
    pub credential_id: i64,
    pub project_id: i64,
    pub relation_type: String,
    pub metadata: Option<String>,
    pub created_at: Option<String>,
}

#[command]
pub async fn create_credential_project_relation(credential_id: i64, project_id: i64, relation_type: Option<String>) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    let relation_type = relation_type.unwrap_or_else(|| "direct".to_string());

    let result = sqlx::query("INSERT INTO credential_project_relations (credential_id, project_id, relation_type, metadata) VALUES (?, ?, ?, ?)")
        .bind(credential_id)
        .bind(project_id)
        .bind(relation_type)
        .bind("{}")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.last_insert_rowid())
}

#[command]
pub async fn delete_credential_project_relation(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM credential_project_relations WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn get_relations_for_credential(credential_id: i64) -> Result<Vec<CredentialProjectRelation>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT id, credential_id, project_id, relation_type, metadata, created_at FROM credential_project_relations WHERE credential_id = ? ORDER BY created_at DESC")
        .bind(credential_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let relations: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(CredentialProjectRelation {
            id: Some(row.get("id")),
            credential_id: row.get("credential_id"),
            project_id: row.get("project_id"),
            relation_type: row.get("relation_type"),
            metadata: row.get("metadata"),
            created_at: row.get::<Option<String>, _>("created_at"),
        })
    }).collect();

    relations
}

#[command]
pub async fn get_vault_items_by_project(project_id: Option<i64>) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    // If no project specified, return all non-archived vault items
    if project_id.is_none() {
        return crate::commands::vault::get_vault_items().await;
    }

    let pid = project_id.unwrap();

    let rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.secret_encrypted, v.url, v.notes, v.category, v.project_id, v.color, v.favicon_url, v.is_archived,
               v.last_rotated_at, v.enable_rotation_reminder, v.rotation_reminder_days,
               v.api_expires_at, v.enable_expiry_alert, v.expiry_alert_days
        FROM vault v
        JOIN credential_project_relations r ON v.id = r.credential_id
        WHERE r.project_id = ? AND v.is_archived = 0
        ORDER BY v.last_modified DESC
        "#
    )
    .bind(pid)
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
pub async fn get_unlinked_vault_items(project_id: i64) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.secret_encrypted, v.url, v.notes, v.category, v.project_id, v.color, v.favicon_url, v.is_archived,
               v.last_rotated_at, v.enable_rotation_reminder, v.rotation_reminder_days,
               v.api_expires_at, v.enable_expiry_alert, v.expiry_alert_days
        FROM vault v
        WHERE v.is_archived = 0
          AND v.id NOT IN (
            SELECT credential_id FROM credential_project_relations WHERE project_id = ?
          )
        ORDER BY v.last_modified DESC
        "#
    )
    .bind(project_id)
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
pub async fn delete_relation_by_credential_and_project(project_id: i64, credential_id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM credential_project_relations WHERE project_id = ? AND credential_id = ?")
        .bind(project_id)
        .bind(credential_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
