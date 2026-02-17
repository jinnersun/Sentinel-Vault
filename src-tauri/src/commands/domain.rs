use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;

/// 域名信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Domain {
    pub id: Option<i64>,
    pub domain: String,
    pub registrar: Option<String>,
    pub registration_date: Option<String>,
    pub expiry_date: Option<String>,
    pub enable_expiry_alert: bool,
    pub expiry_alert_days: i32,
    pub notes: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    // 关联数据
    pub servers: Vec<ServerInfo>,
    pub certificates: Vec<CertificateInfo>,
}

/// 服务器信息（用于关联展示）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerInfo {
    pub id: i64,
    pub title: String,
    pub ip: Option<String>,
}

/// 证书信息（用于关联展示）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CertificateInfo {
    pub id: i64,
    pub cert_name: String,
    pub expires_at: String,
}

/// 创建/更新域名请求
#[derive(Debug, Deserialize)]
pub struct SaveDomainRequest {
    pub id: Option<i64>,
    pub domain: String,
    pub registrar: Option<String>,
    pub registration_date: Option<String>,
    pub expiry_date: Option<String>,
    pub enable_expiry_alert: Option<bool>,
    pub expiry_alert_days: Option<i32>,
    pub notes: Option<String>,
}

/// 获取所有域名
#[command]
pub async fn get_domains() -> Result<Vec<Domain>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, domain, registrar, registration_date, expiry_date,
               enable_expiry_alert, expiry_alert_days, notes, created_at, updated_at
        FROM domains
        ORDER BY domain ASC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut domains = Vec::new();
    
    for row in rows {
        let domain_id: i64 = row.get("id");
        
        // 获取关联的服务器
        let servers = get_domain_servers(&pool, domain_id).await?;
        
        // 获取关联的证书
        let certificates = get_domain_certificates(&pool, domain_id).await?;
        
        domains.push(Domain {
            id: Some(domain_id),
            domain: row.get("domain"),
            registrar: row.get("registrar"),
            registration_date: row.get("registration_date"),
            expiry_date: row.get("expiry_date"),
            enable_expiry_alert: row.get::<i32, _>("enable_expiry_alert") != 0,
            expiry_alert_days: row.get("expiry_alert_days"),
            notes: row.get("notes"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            servers,
            certificates,
        });
    }
    
    Ok(domains)
}

/// 获取域名的关联服务器
async fn get_domain_servers(pool: &sqlx::SqlitePool, domain_id: i64) -> Result<Vec<ServerInfo>, String> {
    let rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.notes
        FROM vault v
        JOIN domain_server_relations dsr ON v.id = dsr.server_id
        WHERE dsr.domain_id = ? AND v.is_archived = 0
        "#
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut servers = Vec::new();
    
    for row in rows {
        let notes_json: Option<String> = row.get("notes");
        let ip = notes_json.as_ref()
            .and_then(|n| serde_json::from_str::<serde_json::Value>(n).ok())
            .and_then(|v| v.get("ip").and_then(|ip| ip.as_str().map(|s| s.to_string())));
        
        servers.push(ServerInfo {
            id: row.get("id"),
            title: row.get("title"),
            ip,
        });
    }
    
    Ok(servers)
}

/// 获取域名的关联证书
async fn get_domain_certificates(pool: &sqlx::SqlitePool, domain_id: i64) -> Result<Vec<CertificateInfo>, String> {
    let rows = sqlx::query(
        r#"
        SELECT c.id, c.cert_name, c.expires_at
        FROM ssl_certificates c
        JOIN certificate_domain_relations cdr ON c.id = cdr.certificate_id
        WHERE cdr.domain_id = ?
        "#
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let certificates = rows.iter().map(|row| {
        CertificateInfo {
            id: row.get("id"),
            cert_name: row.get("cert_name"),
            expires_at: row.get("expires_at"),
        }
    }).collect();
    
    Ok(certificates)
}

/// 创建域名
#[command]
pub async fn create_domain(request: SaveDomainRequest) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let result = sqlx::query(
        r#"
        INSERT INTO domains 
        (domain, registrar, registration_date, expiry_date, enable_expiry_alert, expiry_alert_days, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&request.domain)
    .bind(&request.registrar)
    .bind(&request.registration_date)
    .bind(&request.expiry_date)
    .bind(request.enable_expiry_alert.unwrap_or(true) as i32)
    .bind(request.expiry_alert_days.unwrap_or(30))
    .bind(&request.notes)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result.last_insert_rowid())
}

/// 更新域名
#[command]
pub async fn update_domain(request: SaveDomainRequest) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let id = request.id.ok_or("Domain ID is required")?;
    
    sqlx::query(
        r#"
        UPDATE domains 
        SET domain = ?, registrar = ?, registration_date = ?, expiry_date = ?,
            enable_expiry_alert = ?, expiry_alert_days = ?, notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(&request.domain)
    .bind(&request.registrar)
    .bind(&request.registration_date)
    .bind(&request.expiry_date)
    .bind(request.enable_expiry_alert.unwrap_or(true) as i32)
    .bind(request.expiry_alert_days.unwrap_or(30))
    .bind(&request.notes)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 删除域名
#[command]
pub async fn delete_domain(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // 删除关联关系
    sqlx::query("DELETE FROM domain_server_relations WHERE domain_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    sqlx::query("DELETE FROM certificate_domain_relations WHERE domain_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // 删除域名
    sqlx::query("DELETE FROM domains WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 关联域名和服务器
#[command]
pub async fn link_domain_server(domain_id: i64, server_id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query(
        "INSERT OR IGNORE INTO domain_server_relations (domain_id, server_id) VALUES (?, ?)"
    )
    .bind(domain_id)
    .bind(server_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 解除域名和服务器关联
#[command]
pub async fn unlink_domain_server(domain_id: i64, server_id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query(
        "DELETE FROM domain_server_relations WHERE domain_id = ? AND server_id = ?"
    )
    .bind(domain_id)
    .bind(server_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 获取即将过期的域名
#[command]
pub async fn get_expiring_domains(days: i32) -> Result<Vec<Domain>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, domain, registrar, registration_date, expiry_date,
               enable_expiry_alert, expiry_alert_days, notes
        FROM domains
        WHERE enable_expiry_alert = 1
          AND expiry_date IS NOT NULL
          AND date(expiry_date) <= date('now', ?)
        ORDER BY expiry_date ASC
        "#
    )
    .bind(format!("+{} days", days))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut domains = Vec::new();
    
    for row in rows {
        let domain_id: i64 = row.get("id");
        let servers = get_domain_servers(&pool, domain_id).await?;
        let certificates = get_domain_certificates(&pool, domain_id).await?;
        
        domains.push(Domain {
            id: Some(domain_id),
            domain: row.get("domain"),
            registrar: row.get("registrar"),
            registration_date: row.get("registration_date"),
            expiry_date: row.get("expiry_date"),
            enable_expiry_alert: row.get::<i32, _>("enable_expiry_alert") != 0,
            expiry_alert_days: row.get("expiry_alert_days"),
            notes: row.get("notes"),
            created_at: None,
            updated_at: None,
            servers,
            certificates,
        });
    }
    
    Ok(domains)
}
