use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use uuid::Uuid;
use crate::database::get_db_pool;

/// 解析 CSV 行，正确处理带引号的字段
/// 例如: "name","url","username","password" 或 name,url,username,"pass,word"
fn parse_csv_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    
    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    // 转义的引号
                    current.push('"');
                    chars.next(); // 跳过第二个引号
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                result.push(current.trim().to_string());
                current.clear();
            }
            _ => {
                current.push(c);
            }
        }
    }
    
    // 添加最后一个字段
    if !current.is_empty() || result.len() < line.matches(',').count() + 1 {
        result.push(current.trim().to_string());
    }
    
    result
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
        // 使用 CSV 解析逻辑处理带引号的字段
        let values = parse_csv_line(line);
        if values.len() < password_idx + 1 {
            continue;
        }
        
        let url = values.get(url_idx).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let username = values.get(username_idx).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let password = values.get(password_idx).map(|v| v.trim().to_string()).unwrap_or_default();
        
        if password.is_empty() {
            continue;
        }
        
        // 查询是否已存在（同时匹配 url 和 username，排除已归档的）
        let existing: Option<(i64, String)> = if let Some(ref url_val) = url {
            // 根据用户名是否存在构建不同的查询条件
            let (sql, username_pattern): (String, Option<String>) = if username.as_ref().map_or(false, |u| !u.is_empty()) {
                // 用户名存在：匹配 notes LIKE '%用户名: xxx%'
                let pattern = format!("%用户名: {}%", username.as_deref().unwrap_or(""));
                ("SELECT id, secret_encrypted FROM vault WHERE url = ? AND notes LIKE ? AND category = 'Chrome' AND is_archived = 0".to_string(), Some(pattern))
            } else {
                // 用户名为空：匹配 notes IS NULL 或 notes = ''
                ("SELECT id, secret_encrypted FROM vault WHERE url = ? AND (notes IS NULL OR notes = '') AND category = 'Chrome' AND is_archived = 0".to_string(), None)
            };
            
            let query = sqlx::query_as::<_, (i64, String)>(&sql).bind(url_val);
            let query = if let Some(pattern) = username_pattern {
                query.bind(pattern)
            } else {
                query
            };
            
            query.fetch_optional(&pool).await.map_err(|e| e.to_string())?
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
