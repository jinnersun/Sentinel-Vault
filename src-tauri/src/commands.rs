use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use base64::Engine;  // ← 必须导入 Engine trait
use base64::engine::general_purpose;
use crate::database::{get_db_pool};
use crate::crypto::{generate_salt, hash_password};

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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: Option<i64>,
    pub name: String,
    pub color: String,
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
        SELECT id, title, secret_encrypted, url, notes, category, project_id, color, favicon_url, is_archived
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
pub async fn create_project(project: Project) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let result = sqlx::query("INSERT INTO projects (name, color) VALUES (?, ?)")
        .bind(&project.name)
        .bind(&project.color)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result.last_insert_rowid())
}

#[command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query("SELECT id, name, color FROM projects ORDER BY name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let projects: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(Project {
            id: Some(row.get("id")),
            name: row.get("name"),
            color: row.get("color"),
        })
    }).collect();
    
    projects
}

#[command]
pub async fn search_items(query: String) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, title, secret_encrypted, url, notes, category, project_id, color, favicon_url, is_archived
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
        })
    }).collect();
    
    items
}

#[command]
pub async fn copy_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 使用 clipboard-win 5.4.x API
        use clipboard_win::set_clipboard_string;
        set_clipboard_string(&text)
            .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        eprintln!("Clipboard not implemented for this platform");
        Ok(())
    }
}

#[command]
pub async fn fetch_favicon(url: String) -> Result<String, String> {
    if url.is_empty() {
        return Ok("https://www.google.com/s2/favicons?domain=example.com&sz=32".to_string());
    }
    
    // Extract domain from URL
    let domain = match url::Url::parse(&url) {
        Ok(parsed_url) => {
            parsed_url.host_str().unwrap_or("example.com").to_string()
        },
        Err(_) => "example.com".to_string(),
    };
    
    Ok(format!("https://www.google.com/s2/favicons?domain={}&sz=32", domain))
}

#[command]
pub async fn set_master_password(password: String) -> Result<(), String> {
    let pool = get_db_pool().await?;
    let salt = generate_salt();
    let hashed = hash_password(&password, &salt);
    
    // Store salt and hash in settings
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind("master_password_salt")
        .bind(general_purpose::STANDARD.encode(&salt))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind("master_password_hash")
        .bind(hashed)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn has_master_password() -> Result<bool, String> {
    let pool = get_db_pool().await?;
    
    let result: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'master_password_hash'")
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result.is_some())
}

#[command]
pub async fn verify_master_password(password: String) -> Result<bool, String> {
    let pool = get_db_pool().await?;
    
    let salt_result: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'master_password_salt'")
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let hash_result: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'master_password_hash'")
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    match (salt_result, hash_result) {
        (Some(salt_str), Some(stored_hash)) => {
            let salt_bytes = general_purpose::STANDARD.decode(&salt_str)
                .map_err(|_| "Invalid salt encoding".to_string())?;
            let salt_array: [u8; 32] = salt_bytes.try_into()
                .map_err(|_| "Invalid salt length".to_string())?;
            
            let input_hash = hash_password(&password, &salt_array);
            Ok(input_hash == stored_hash)
        },
        _ => Ok(false), // No password set yet
    }
}