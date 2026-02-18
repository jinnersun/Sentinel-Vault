use tauri::command;
use base64::Engine;
use base64::engine::general_purpose;
use crate::database::get_db_pool;
use crate::crypto::{generate_salt, hash_password};
// use std::path::Path;
use sqlx::Row;

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

// 获取设置值
#[command]
pub async fn get_setting(key: String) -> Result<Option<String>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let result: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result)
}

// 更新设置值
#[command]
pub async fn update_setting(key: String, value: String) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&value)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// 备份数据库
#[command]
pub async fn backup_database(target_path: String) -> Result<(), String> {
    // 获取数据库连接池
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // 使用 PRAGMA database_list 获取数据库文件路径
    // 返回 (seq, name, file) 三列，我们需要 file 列
    let row = sqlx::query("PRAGMA database_list")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("获取数据库路径失败: {}", e))?;
    
    // 提取 file 列（索引 2）
    let db_path: String = row.try_get(2)
        .map_err(|e| format!("解析数据库路径失败: {}", e))?;
    
    // 复制数据库文件
    std::fs::copy(&db_path, &target_path)
        .map_err(|e| format!("备份失败: {}", e))?;
    
    Ok(())
}

// 清空所有数据（保留 settings 表）
#[command]
pub async fn clear_all_data() -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // 按照外键依赖顺序清空表（先清子表，再清父表）
    // 1. 先清空关联表和历史表
    sqlx::query("DELETE FROM credential_project_relations").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM vault_history").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM chrome_imported_passwords").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM import_logs").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM domain_server_relations").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM certificate_domain_relations").execute(&pool).await.map_err(|e| e.to_string())?;
    
    // 2. 再清空主表
    sqlx::query("DELETE FROM api_keys_registry").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM vault").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM projects").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM domains").execute(&pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM ssl_certificates").execute(&pool).await.map_err(|e| e.to_string())?;
    
    Ok(())
}
