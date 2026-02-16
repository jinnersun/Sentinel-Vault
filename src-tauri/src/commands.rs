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
    pub status: String,
    pub description: String,
    pub arch_desc: String,
    pub readme_path: Option<String>,
    pub urls_json: String,
}

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
    
    let result = sqlx::query("INSERT INTO projects (name, color, status, description, arch_desc, readme_path, urls_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&project.name)
        .bind(&project.color)
        .bind(&project.status)
        .bind(&project.description)
        .bind(&project.arch_desc)
        .bind(&project.readme_path)
        .bind(&project.urls_json)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result.last_insert_rowid())
}

#[command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query("SELECT id, name, color, status, description, arch_desc, readme_path, urls_json FROM projects ORDER BY name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let projects: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(Project {
            id: Some(row.get("id")),
            name: row.get("name"),
            color: row.get("color"),
            status: row.get("status"),
            description: row.get("description"),
            arch_desc: row.get("arch_desc"),
            readme_path: row.get("readme_path"),
            urls_json: row.get("urls_json"),
        })
    }).collect();
    
    projects
}

#[command]
pub async fn update_project(id: i64, project: Project) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query("UPDATE projects SET name = ?, color = ?, status = ?, description = ?, arch_desc = ?, readme_path = ?, urls_json = ? WHERE id = ?")
        .bind(&project.name)
        .bind(&project.color)
        .bind(&project.status)
        .bind(&project.description)
        .bind(&project.arch_desc)
        .bind(&project.readme_path)
        .bind(&project.urls_json)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn delete_project(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // First delete all relations to this project
    sqlx::query("DELETE FROM credential_project_relations WHERE project_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // Then delete the project
    sqlx::query("DELETE FROM projects WHERE id = ?")
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectWithCount {
    pub id: Option<i64>,
    pub name: String,
    pub color: String,
    pub count: i64,
}

#[command]
pub async fn get_project_counts() -> Result<Vec<ProjectWithCount>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT p.id, p.name, p.color, COUNT(r.id) as count FROM projects p LEFT JOIN credential_project_relations r ON p.id = r.project_id GROUP BY p.id ORDER BY p.name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let projects: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(ProjectWithCount {
            id: Some(row.get("id")),
            name: row.get("name"),
            color: row.get("color"),
            count: row.get::<i64, _>("count"),
        })
    }).collect();

    projects
}

#[command]
pub async fn get_vault_items_by_project(project_id: Option<i64>) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    // If no project specified, return all non-archived vault items
    if project_id.is_none() {
        return get_vault_items().await;
    }

    let pid = project_id.unwrap();

    let rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.secret_encrypted, v.url, v.notes, v.category, v.project_id, v.color, v.favicon_url, v.is_archived
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
        })
    }).collect();

    items
}

#[command]
pub async fn get_unlinked_vault_items(project_id: i64) -> Result<Vec<VaultItem>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.secret_encrypted, v.url, v.notes, v.category, v.project_id, v.color, v.favicon_url, v.is_archived
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

#[command]
pub async fn get_import_records() -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT id, origin_url, username, password, vault_item_id, imported_at, metadata FROM chrome_imported_passwords ORDER BY imported_at DESC")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows.iter() {
        let rec = serde_json::json!({
            "id": row.get::<i64, _>("id"),
            "origin_url": row.get::<Option<String>, _>("origin_url"),
            "username": row.get::<Option<String>, _>("username"),
            "password": row.get::<Option<String>, _>("password"),
            "vault_item_id": row.get::<Option<i64>, _>("vault_item_id"),
            "imported_at": row.get::<Option<String>, _>("imported_at"),
            "metadata": row.get::<Option<String>, _>("metadata"),
        });
        results.push(rec);
    }

    Ok(results)
}

#[command]
pub async fn delete_import_record(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM chrome_imported_passwords WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

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

// Chrome 导入相关结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportPreview {
    pub batch_id: String,
    pub total_count: usize,
    pub new_items: Vec<ImportRecord>,
    pub conflict_items: Vec<ImportRecord>,
    pub identical_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportRecord {
    pub id: i64,
    pub origin_url: Option<String>,
    pub username: Option<String>,
    pub password: String,
    pub status: String,
    pub existing_vault_id: Option<i64>,
    pub existing_password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportDecision {
    pub import_id: i64,
    pub decision: String, // 'update' | 'skip'
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: String,
    pub imported: usize,
    pub updated: usize,
    pub skipped: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryRecord {
    pub id: i64,
    pub vault_id: i64,
    pub old_secret_encrypted: String,
    pub change_reason: Option<String>,
    pub created_at: String,
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

#[command]
pub async fn import_record_to_vault(import_id: i64) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    // Fetch import record
    let row = sqlx::query("SELECT origin_url, username, password FROM chrome_imported_passwords WHERE id = ?")
        .bind(import_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let origin_url: Option<String> = row.get("origin_url");
    let username: Option<String> = row.get("username");
    let password: Option<String> = row.get("password");

    let title = if let Some(u) = &username {
        format!("{}@{}", u, origin_url.clone().unwrap_or_else(|| "imported".to_string()))
    } else {
        origin_url.clone().unwrap_or_else(|| "Imported Item".to_string())
    };

    let secret_encrypted = password.unwrap_or_default();

    // Insert into vault
    let result = sqlx::query("INSERT INTO vault (title, secret_encrypted, url, notes, category, color, is_archived, created_at, last_modified) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
        .bind(&title)
        .bind(&secret_encrypted)
        .bind(&origin_url)
        .bind(Option::<String>::None)
        .bind("imported")
        .bind("#3b82f6")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let new_id = result.last_insert_rowid();

    // Update import record to reference new vault item
    sqlx::query("UPDATE chrome_imported_passwords SET vault_item_id = ? WHERE id = ?")
        .bind(new_id)
        .bind(import_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_id)
}

// Chrome 导入新命令
use uuid::Uuid;

#[command]
pub async fn parse_and_compare_csv(file_path: String) -> Result<ImportPreview, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    let batch_id = Uuid::new_v4().to_string();
    
    // 读取 CSV 文件
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() < 2 {
        return Err("CSV file is empty or has no data".to_string());
    }
    
    // 解析表头
    let headers: Vec<&str> = lines[0].split(',').map(|h| h.trim()).collect();
    let _name_idx = headers.iter().position(|&h| h.eq_ignore_ascii_case("name"));
    let url_idx = headers.iter().position(|&h| h.eq_ignore_ascii_case("url"));
    let username_idx = headers.iter().position(|&h| h.eq_ignore_ascii_case("username"));
    let password_idx = headers.iter().position(|&h| h.eq_ignore_ascii_case("password"));
    
    if url_idx.is_none() || username_idx.is_none() || password_idx.is_none() {
        return Err("CSV missing required columns: url, username, password".to_string());
    }
    
    let url_idx = url_idx.unwrap();
    let username_idx = username_idx.unwrap();
    let password_idx = password_idx.unwrap();
    
    let mut new_items = Vec::new();
    let mut conflict_items = Vec::new();
    let mut identical_count = 0;
    
    // 逐条处理
    for line in &lines[1..] {
        let values: Vec<&str> = line.split(',').collect();
        if values.len() < password_idx + 1 {
            continue;
        }
        
        let url = values.get(url_idx).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let username = values.get(username_idx).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let password = values.get(password_idx).map(|v| v.trim().to_string()).unwrap_or_default();
        
        if password.is_empty() {
            continue;
        }
        
        // 查询是否已存在（同时匹配 url 和 username）
        let existing: Option<(i64, String)> = if let Some(ref url_val) = url {
            let username_pattern = format!("%用户名: {}%", username.as_deref().unwrap_or(""));
            sqlx::query_as::<_, (i64, String)>(
                "SELECT id, secret_encrypted FROM vault WHERE url = ? AND notes LIKE ? AND category = 'Chrome'"
            )
            .bind(url_val)
            .bind(&username_pattern)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?
        } else {
            None
        };
        
        let (status, existing_vault_id, existing_password) = if let Some((id, existing_pass)) = existing {
            if existing_pass == password {
                ("Identical", Some(id), Some(existing_pass))
            } else {
                ("Conflict", Some(id), Some(existing_pass))
            }
        } else {
            ("New", None, None)
        };
        
        // 存入临时表
        let result = sqlx::query(
            "INSERT INTO chrome_imported_passwords (batch_id, origin_url, username, password, status, existing_vault_id, existing_password) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&batch_id)
        .bind(&url)
        .bind(&username)
        .bind(&password)
        .bind(status)
        .bind(existing_vault_id)
        .bind(&existing_password)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let import_id = result.last_insert_rowid();
        
        let record = ImportRecord {
            id: import_id,
            origin_url: url,
            username,
            password: password.clone(),
            status: status.to_string(),
            existing_vault_id,
            existing_password: existing_password.clone(),
        };
        
        match status {
            "New" => new_items.push(record),
            "Conflict" => conflict_items.push(record),
            "Identical" => identical_count += 1,
            _ => {}
        }
    }
    
    Ok(ImportPreview {
        batch_id,
        total_count: new_items.len() + conflict_items.len() + identical_count,
        new_items,
        conflict_items,
        identical_count,
    })
}

#[command]
pub async fn process_import_batch(batch_id: String, decisions: Vec<ImportDecision>) -> Result<ImportResult, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let mut imported = 0;
    let mut updated = 0;
    let mut skipped = 0;
    
    for decision in decisions {
        let record = sqlx::query_as::<_, (String, Option<String>, Option<String>, String, Option<i64>)>(
            "SELECT origin_url, username, password, status, existing_vault_id FROM chrome_imported_passwords WHERE id = ? AND batch_id = ?"
        )
        .bind(decision.import_id)
        .bind(&batch_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let (url, username, password, status, existing_vault_id) = record;
        let url_opt: Option<String> = if url.is_empty() { None } else { Some(url) };
        
        if decision.decision == "skip" {
            skipped += 1;
        } else if decision.decision == "update" && status == "Conflict" {
            if let Some(vault_id) = existing_vault_id {
                // 归档旧密码
                let existing_pass: String = sqlx::query_scalar("SELECT secret_encrypted FROM vault WHERE id = ?")
                    .bind(vault_id)
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
                
                sqlx::query("INSERT INTO vault_history (vault_id, old_secret_encrypted, change_reason, source_url) VALUES (?, ?, ?, ?)")
                    .bind(vault_id)
                    .bind(&existing_pass)
                    .bind("Chrome Import Update")
                    .bind(&url_opt)
                    .execute(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
                
                // 更新新密码
                sqlx::query("UPDATE vault SET secret_encrypted = ? WHERE id = ?")
                    .bind(&password)
                    .bind(vault_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
                
                updated += 1;
            }
        } else if decision.decision == "import" && status == "New" {
            // 创建新条目
            let title = match &url_opt {
                Some(u) => {
                    let domain = u.split('/').nth(2).unwrap_or("未命名");
                    domain.replace("www.", "")
                }
                None => "未命名".to_string(),
            };
            
            let notes = username.as_ref().map(|u| format!("用户名: {}", u));
            
            sqlx::query(
                "INSERT INTO vault (title, secret_encrypted, url, notes, category, project_id, color, is_archived) VALUES (?, ?, ?, ?, 'Chrome', NULL, '#10b981', 0)"
            )
            .bind(&title)
            .bind(password.clone())
            .bind(&url_opt)
            .bind(notes)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
            
            imported += 1;
        }
        
        // 标记为已处理
        sqlx::query("UPDATE chrome_imported_passwords SET decision = ? WHERE id = ?")
            .bind(&decision.decision)
            .bind(decision.import_id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    // 记录导入日志
    let total = (imported + updated + skipped) as i32;
    let imported_i = imported as i32;
    let updated_i = updated as i32;
    let skipped_i = skipped as i32;
    sqlx::query("INSERT INTO import_logs (batch_id, total_count, new_count, conflict_count, skipped_count, updated_count) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&batch_id)
        .bind(total)
        .bind(imported_i)
        .bind(updated_i)
        .bind(skipped_i)
        .bind(updated_i)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // 清理临时数据
    sqlx::query("DELETE FROM chrome_imported_passwords WHERE batch_id = ?")
        .bind(&batch_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(ImportResult {
        batch_id,
        imported,
        updated,
        skipped,
    })
}

#[command]
pub async fn get_vault_history(vault_id: i64) -> Result<Vec<HistoryRecord>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query_as::<_, (i64, i64, String, Option<String>, String)>(
        "SELECT id, vault_id, old_secret_encrypted, change_reason, created_at FROM vault_history WHERE vault_id = ? ORDER BY created_at DESC"
    )
    .bind(vault_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let records: Vec<HistoryRecord> = rows.into_iter().map(|(id, vault_id, old_secret_encrypted, change_reason, created_at)| {
        HistoryRecord {
            id,
            vault_id,
            old_secret_encrypted,
            change_reason,
            created_at,
        }
    }).collect();
    
    Ok(records)
}

#[command]
pub async fn read_project_readme(path: String) -> Result<String, String> {
    // 安全检查：只允许读取 .md 文件
    if !path.ends_with(".md") {
        return Err("仅支持读取 .md 文件".to_string());
    }
    
    // 检查路径遍历攻击
    if path.contains("..") {
        return Err("非法路径".to_string());
    }
    
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))
}