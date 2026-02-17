use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;
use std::path::PathBuf;
use std::fs;
use x509_parser::pem::parse_x509_pem;
use x509_parser::prelude::*;
use x509_parser::extensions::ParsedExtension;
use crate::commands::copy_to_clipboard;

/// SSL 证书信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSLCertificate {
    pub id: Option<i64>,
    pub cert_name: String,
    pub domains: Vec<String>,
    pub issuer: Option<String>,
    pub issued_at: Option<String>,
    pub expires_at: String,
    pub enable_expiry_alert: bool,
    pub expiry_alert_days: i32,
    pub cert_file_path: Option<String>,
    pub key_file_path: Option<String>,
    pub chain_file_path: Option<String>,
    pub notes: Option<String>,
}

/// 证书上传请求
#[derive(Debug, Deserialize)]
pub struct UploadCertificateRequest {
    pub cert_name: String,
    pub cert_content: String,  // PEM 格式的证书内容
    pub key_content: Option<String>,  // 私钥内容（可选）
    pub chain_content: Option<String>, // 证书链（可选）
    pub notes: Option<String>,
}

/// 解析证书信息
fn parse_certificate_info(cert_pem: &str) -> Result<(Vec<String>, Option<String>, String), String> {
    // 解析 PEM
    let (_, pem) = parse_x509_pem(cert_pem.as_bytes())
        .map_err(|e| format!("Failed to parse PEM: {}", e))?;
    
    // 解析 X509
    let cert = pem.parse_x509()
        .map_err(|e| format!("Failed to parse X509: {}", e))?;
    
    // 获取颁发机构
    let issuer = cert.issuer().to_string();
    let issuer_name = issuer.split("=")
        .nth(1)
        .and_then(|s| s.split(",").next())
        .map(|s| s.trim().to_string());
    
    // 获取过期时间
    let not_after = cert.validity().not_after.to_string();
    // 转换格式：X509 格式通常是 "Mar 15 12:00:00 2025 GMT"
    let expires_at = parse_x509_date(&not_after)?;
    
    // 获取域名列表（Subject Alternative Names）
    let mut domains = Vec::new();
    
    // 从 subject 获取 CN
    if let Some(cn) = cert.subject().iter_common_name().next() {
        if let Ok(cn_str) = cn.as_str() {
            domains.push(cn_str.to_string());
        }
    }
    
    // 从 SAN 扩展获取所有域名
    for ext in cert.extensions() {
        if let ParsedExtension::SubjectAlternativeName(san) = ext.parsed_extension() {
            for name in san.general_names.iter() {
                match name {
                    GeneralName::DNSName(dns) => {
                        domains.push(dns.to_string());
                    }
                    _ => {}
                }
            }
        }
    }
    
    // 去重
    domains.sort();
    domains.dedup();
    
    Ok((domains, issuer_name, expires_at))
}

/// 解析 X509 日期格式为 ISO 8601
fn parse_x509_date(date_str: &str) -> Result<String, String> {
    // 尝试解析 "Mar 15 12:00:00 2025 GMT" 格式
    let parts: Vec<&str> = date_str.split_whitespace().collect();
    if parts.len() >= 4 {
        let month = match parts[0] {
            "Jan" => "01", "Feb" => "02", "Mar" => "03", "Apr" => "04",
            "May" => "05", "Jun" => "06", "Jul" => "07", "Aug" => "08",
            "Sep" => "09", "Oct" => "10", "Nov" => "11", "Dec" => "12",
            _ => return Err(format!("Unknown month: {}", parts[0])),
        };
        let day = parts[1];
        let year = parts[3];
        return Ok(format!("{}-{}-{}", year, month, day));
    }
    
    Err(format!("Cannot parse date: {}", date_str))
}

/// 确保证书存储目录存在
fn ensure_cert_dir() -> Result<PathBuf, String> {
    let app_dir = dirs::data_dir()
        .ok_or("Cannot get data directory")?
        .join("DevVault")
        .join("certs");
    
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create cert directory: {}", e))?;
    
    Ok(app_dir)
}

/// 保存证书文件
fn save_cert_file(cert_name: &str, content: &str, suffix: &str) -> Result<String, String> {
    let cert_dir = ensure_cert_dir()?;
    let file_name = format!("{}_{}.pem", cert_name.replace(" ", "_"), suffix);
    let file_path = cert_dir.join(&file_name);
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write cert file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

/// 上传并解析证书
#[command]
pub async fn upload_certificate(
    request: UploadCertificateRequest,
) -> Result<SSLCertificate, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // 解析证书信息
    let (domains, issuer, expires_at) = parse_certificate_info(&request.cert_content)?;
    
    if domains.is_empty() {
        return Err("Certificate does not contain any domain names".to_string());
    }
    
    // 保存证书文件
    let cert_file_path = save_cert_file(&request.cert_name, &request.cert_content, "cert")?;
    
    let key_file_path = if let Some(key) = request.key_content {
        Some(save_cert_file(&request.cert_name, &key, "key")?)
    } else {
        None
    };
    
    let chain_file_path = if let Some(chain) = request.chain_content {
        Some(save_cert_file(&request.cert_name, &chain, "chain")?)
    } else {
        None
    };
    
    // 将域名列表转为 JSON
    let domains_json = serde_json::to_string(&domains)
        .map_err(|e| format!("Failed to serialize domains: {}", e))?;
    
    // 插入数据库
    let result = sqlx::query(
        r#"
        INSERT INTO ssl_certificates 
        (cert_name, domains, issuer, expires_at, enable_expiry_alert, expiry_alert_days,
         cert_file_path, key_file_path, chain_file_path, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&request.cert_name)
    .bind(&domains_json)
    .bind(&issuer)
    .bind(&expires_at)
    .bind(1) // enable_expiry_alert default true
    .bind(30) // expiry_alert_days default 30
    .bind(&cert_file_path)
    .bind(&key_file_path)
    .bind(&chain_file_path)
    .bind(&request.notes)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 自动关联域名
    for domain in &domains {
        // 检查域名是否已存在
        let existing: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM domains WHERE domain = ?"
        )
        .bind(domain)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let domain_id = if let Some(id) = existing {
            id
        } else {
            // 创建新域名
            let result = sqlx::query(
                "INSERT INTO domains (domain, enable_expiry_alert, expiry_alert_days) VALUES (?, ?, ?)"
            )
            .bind(domain)
            .bind(1)
            .bind(30)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
            result.last_insert_rowid()
        };
        
        // 建立证书-域名关联
        sqlx::query(
            "INSERT OR IGNORE INTO certificate_domain_relations (certificate_id, domain_id) VALUES (?, ?)"
        )
        .bind(result.last_insert_rowid())
        .bind(domain_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    
    Ok(SSLCertificate {
        id: Some(result.last_insert_rowid()),
        cert_name: request.cert_name,
        domains,
        issuer,
        issued_at: None,
        expires_at,
        enable_expiry_alert: true,
        expiry_alert_days: 30,
        cert_file_path: Some(cert_file_path),
        key_file_path,
        chain_file_path,
        notes: request.notes,
    })
}

/// 获取所有证书
#[command]
pub async fn get_certificates() -> Result<Vec<SSLCertificate>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query(
        r#"
        SELECT id, cert_name, domains, issuer, issued_at, expires_at,
               enable_expiry_alert, expiry_alert_days,
               cert_file_path, key_file_path, chain_file_path, notes
        FROM ssl_certificates
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut certificates = Vec::new();
    
    for row in rows {
        let domains_json: String = row.get("domains");
        let domains: Vec<String> = serde_json::from_str(&domains_json)
            .unwrap_or_default();
        
        certificates.push(SSLCertificate {
            id: Some(row.get("id")),
            cert_name: row.get("cert_name"),
            domains,
            issuer: row.get("issuer"),
            issued_at: row.get("issued_at"),
            expires_at: row.get("expires_at"),
            enable_expiry_alert: row.get::<i32, _>("enable_expiry_alert") != 0,
            expiry_alert_days: row.get("expiry_alert_days"),
            cert_file_path: row.get("cert_file_path"),
            key_file_path: row.get("key_file_path"),
            chain_file_path: row.get("chain_file_path"),
            notes: row.get("notes"),
        });
    }
    
    Ok(certificates)
}

/// 删除证书
#[command]
pub async fn delete_certificate(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // 获取证书文件路径
    let cert_info: (Option<String>, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT cert_file_path, key_file_path, chain_file_path FROM ssl_certificates WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 删除文件
    if let Some(path) = cert_info.0 {
        let _ = fs::remove_file(path);
    }
    if let Some(path) = cert_info.1 {
        let _ = fs::remove_file(path);
    }
    if let Some(path) = cert_info.2 {
        let _ = fs::remove_file(path);
    }
    
    // 删除关联记录
    sqlx::query("DELETE FROM certificate_domain_relations WHERE certificate_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // 删除证书记录
    sqlx::query("DELETE FROM ssl_certificates WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 读取证书文件内容
#[command]
pub async fn read_certificate_file(cert_id: i64, file_type: String) -> Result<String, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let column = match file_type.as_str() {
        "cert" => "cert_file_path",
        "key" => "key_file_path",
        "chain" => "chain_file_path",
        _ => return Err("Invalid file type".to_string()),
    };
    
    let query = format!("SELECT {} FROM ssl_certificates WHERE id = ?", column);
    let file_path: Option<String> = sqlx::query_scalar(&query)
        .bind(cert_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(path) = file_path {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        Ok(content)
    } else {
        Err("File not found".to_string())
    }
}

/// 复制证书内容到剪贴板
#[command]
pub async fn copy_certificate_to_clipboard(cert_id: i64, file_type: String) -> Result<(), String> {
    let content = read_certificate_file(cert_id, file_type).await?;
    copy_to_clipboard(content).await
}

/// 获取证书文件路径（用于下载）
#[command]
pub async fn get_certificate_file_path(cert_id: i64, file_type: String) -> Result<String, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let column = match file_type.as_str() {
        "cert" => "cert_file_path",
        "key" => "key_file_path",
        "chain" => "chain_file_path",
        _ => return Err("Invalid file type".to_string()),
    };
    
    let query = format!("SELECT {} FROM ssl_certificates WHERE id = ?", column);
    let file_path: Option<String> = sqlx::query_scalar(&query)
        .bind(cert_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    file_path.ok_or_else(|| "File not found".to_string())
}
