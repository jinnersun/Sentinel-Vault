use serde::{Deserialize, Serialize};
use tauri::command;
use chrono::NaiveDate;

/// 域名信息查询结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DomainInfoResult {
    pub domain: String,
    pub registrar: Option<String>,
    pub registration_date: Option<String>,
    pub expiry_date: Option<String>,
    pub name_servers: Vec<String>,
    pub status: Vec<String>,
    pub source: String, // "rdap" | "fallback"
}

/// 使用 RDAP 查询域名信息（优先）
#[command]
pub async fn fetch_domain_info(domain: String) -> Result<DomainInfoResult, String> {
    // 首先尝试 RDAP 查询
    match query_rdap(&domain).await {
        Ok(result) => Ok(result),
        Err(e) => {
            println!("RDAP query failed for {}: {}, trying fallback...", domain, e);
            // RDAP 失败，使用备用方案
            query_fallback(&domain).await
        }
    }
}

/// RDAP 查询 - 使用 HTTP 直接调用
async fn query_rdap(domain: &str) -> Result<DomainInfoResult, String> {
    // 根据域名后缀选择 RDAP 服务器
    let tld = domain.split('.').last().unwrap_or("").to_lowercase();
    
    let rdap_server = get_rdap_server(&tld)
        .ok_or_else(|| format!("Unsupported TLD: {}", tld))?;
    
    let url = format!("{}domain/{}", rdap_server, domain);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;
    
    let response = client.get(&url)
        .header("Accept", "application/rdap+json")
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}: {}", response.status(), response.text().await.unwrap_or_default()));
    }
    
    let data: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;
    
    parse_rdap_response(domain, &data)
}

/// 获取 RDAP 服务器地址
fn get_rdap_server(tld: &str) -> Option<&'static str> {
    match tld {
        "com" | "net" => Some("https://rdap.verisign.com/com/v1/"),
        "org" => Some("https://rdap.publicinterestregistry.org/rdap/"),
        "io" => Some("https://rdap.nic.io/"),
        "app" | "dev" => Some("https://rdap.nic.google/"),
        "cloud" => Some("https://rdap.nic.cloud/"),
        "info" => Some("https://rdap.afilias.info/rdap/"),
        "biz" => Some("https://rdap.nic.biz/"),
        "co" => Some("https://rdap.nic.co/"),
        "ai" => Some("https://rdap.nic.ai/"),
        "cc" => Some("https://rdap.nic.cc/"),
        "tv" => Some("https://rdap.nic.tv/"),
        "me" => Some("https://rdap.nic.me/"),
        "cn" => Some("https://rdap.cnnic.cn/"),
        _ => None,
    }
}

/// 解析 RDAP JSON 响应
fn parse_rdap_response(domain: &str, data: &serde_json::Value) -> Result<DomainInfoResult, String> {
    let mut registrar = None;
    let mut registration_date = None;
    let mut expiry_date = None;
    let mut name_servers = Vec::new();
    let mut status = Vec::new();
    
    // 解析 events
    if let Some(events) = data.get("events").and_then(|e| e.as_array()) {
        for event in events {
            if let (Some(action), Some(date)) = (
                event.get("eventAction").and_then(|a| a.as_str()),
                event.get("eventDate").and_then(|d| d.as_str())
            ) {
                let date_str = parse_rdap_date(date);
                match action {
                    "registration" => registration_date = date_str,
                    "expiration" | "expiration date" | "registry expiration" => expiry_date = date_str,
                    _ => {}
                }
            }
        }
    }
    
    // 解析 entities (registrar)
    if let Some(entities) = data.get("entities").and_then(|e| e.as_array()) {
        for entity in entities {
            if let Some(roles) = entity.get("roles").and_then(|r| r.as_array()) {
                let is_registrar = roles.iter().any(|r| r.as_str() == Some("registrar"));
                if is_registrar {
                    // 尝试从 vcardArray 获取注册商名称
                    if let Some(vcard) = entity.get("vcardArray").and_then(|v| v.as_array()) {
                        registrar = extract_vcard_org(vcard);
                    }
                    // 备用：从 publicIds 获取
                    if registrar.is_none() {
                        if let Some(public_ids) = entity.get("publicIds").and_then(|p| p.as_array()) {
                            for pid in public_ids {
                                if let Some(type_val) = pid.get("type").and_then(|t| t.as_str()) {
                                    if type_val == "IANA Registrar ID" {
                                        // 可以通过 ID 查找名称，这里简化处理
                                        registrar = Some(format!("Registrar ID: {}", 
                                            pid.get("identifier").and_then(|i| i.as_str()).unwrap_or("Unknown")));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 解析 nameservers
    if let Some(nameservers_arr) = data.get("nameservers").and_then(|n| n.as_array()) {
        for ns in nameservers_arr {
            if let Some(ldh) = ns.get("ldhName").and_then(|l| l.as_str()) {
                name_servers.push(ldh.to_lowercase());
            }
        }
    }
    
    // 解析 status
    if let Some(status_arr) = data.get("status").and_then(|s| s.as_array()) {
        status = status_arr.iter()
            .filter_map(|s| s.as_str().map(|s| s.to_string()))
            .collect();
    }
    
    Ok(DomainInfoResult {
        domain: domain.to_string(),
        registrar,
        registration_date,
        expiry_date,
        name_servers,
        status,
        source: "rdap".to_string(),
    })
}

/// 备用查询方案（简单的 WHOIS 解析）
async fn query_fallback(domain: &str) -> Result<DomainInfoResult, String> {
    // 使用简单的 HTTP API 作为备用（例如 whoisxmlapi 或其他免费服务）
    // 这里使用一个简单的基于正则的解析器
    
    // 对于常见 TLD，尝试构造 RDAP 直接端点
    let tld = domain.split('.').last().unwrap_or("");
    
    // 尝试通过 IANA bootstrap 获取 RDAP 服务器
    match try_iana_bootstrap(domain, tld).await {
        Ok(result) => Ok(result),
        Err(_) => {
            // 如果都失败了，返回一个基本结果
            Ok(DomainInfoResult {
                domain: domain.to_string(),
                registrar: None,
                registration_date: None,
                expiry_date: None,
                name_servers: Vec::new(),
                status: Vec::new(),
                source: "unavailable".to_string(),
            })
        }
    }
}

/// 尝试通过 IANA bootstrap 查询
async fn try_iana_bootstrap(domain: &str, tld: &str) -> Result<DomainInfoResult, String> {
    // IANA RDAP bootstrap 端点
    let _bootstrap_url = format!("https://data.iana.org/rdap/dns.json");
    
    // 这里简化处理，实际应该解析 bootstrap 文件
    // 对于常见 TLD 使用已知端点
    let rdap_server = match tld {
        "com" | "net" => "https://rdap.verisign.com/com/v1/",
        "org" => "https://rdap.publicinterestregistry.org/rdap/",
        "io" => "https://rdap.nic.io/",
        "app" | "dev" => "https://rdap.nic.google/",
        "cloud" => "https://rdap.nic.cloud/",
        _ => return Err("Unsupported TLD".to_string()),
    };
    
    let url = format!("{}domain/{}", rdap_server, domain);
    
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}: {}", response.status(), response.text().await.unwrap_or_default()));
    }
    
    let data: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;
    
    // 解析 JSON 响应
    let mut registrar = None;
    let mut registration_date = None;
    let mut expiry_date = None;
    let mut name_servers = Vec::new();
    let mut status = Vec::new();
    
    // 解析 events
    if let Some(events) = data.get("events").and_then(|e| e.as_array()) {
        for event in events {
            if let (Some(action), Some(date)) = (
                event.get("eventAction").and_then(|a| a.as_str()),
                event.get("eventDate").and_then(|d| d.as_str())
            ) {
                let date_str = parse_rdap_date(date);
                match action {
                    "registration" => registration_date = date_str,
                    "expiration" => expiry_date = date_str,
                    _ => {}
                }
            }
        }
    }
    
    // 解析 entities (registrar)
    if let Some(entities) = data.get("entities").and_then(|e| e.as_array()) {
        for entity in entities {
            if let Some(roles) = entity.get("roles").and_then(|r| r.as_array()) {
                let is_registrar = roles.iter().any(|r| r.as_str() == Some("registrar"));
                if is_registrar {
                    if let Some(vcard) = entity.get("vcardArray").and_then(|v| v.as_array()) {
                        registrar = extract_vcard_org(vcard);
                    }
                }
            }
        }
    }
    
    // 解析 nameservers
    if let Some(nameservers_arr) = data.get("nameservers").and_then(|n| n.as_array()) {
        for ns in nameservers_arr {
            if let Some(ldh) = ns.get("ldhName").and_then(|l| l.as_str()) {
                name_servers.push(ldh.to_lowercase());
            }
        }
    }
    
    // 解析 status
    if let Some(status_arr) = data.get("status").and_then(|s| s.as_array()) {
        status = status_arr.iter()
            .filter_map(|s| s.as_str().map(|s| s.to_string()))
            .collect();
    }
    
    Ok(DomainInfoResult {
        domain: domain.to_string(),
        registrar,
        registration_date,
        expiry_date,
        name_servers,
        status,
        source: "rdap-bootstrap".to_string(),
    })
}

/// 解析 RDAP 日期格式
fn parse_rdap_date(date_str: &str) -> Option<String> {
    // RDAP 日期格式通常是 ISO 8601: 2024-12-31T23:59:59Z
    if let Some(date_part) = date_str.split('T').next() {
        if NaiveDate::parse_from_str(date_part, "%Y-%m-%d").is_ok() {
            return Some(date_part.to_string());
        }
    }
    None
}

/// 从 JSON vCard 提取组织名称
fn extract_vcard_org(vcard: &Vec<serde_json::Value>) -> Option<String> {
    // vCardArray 格式: ["vcard", [["fn", {}, "text", "Name"], ...]]
    if vcard.len() < 2 {
        return None;
    }
    
    if let Some(properties) = vcard[1].as_array() {
        for prop in properties {
            if let Some(prop_arr) = prop.as_array() {
                if prop_arr.len() >= 4 {
                    if let Some(name) = prop_arr[0].as_str() {
                        if name == "fn" || name == "org" {
                            return prop_arr[3].as_str().map(|s| s.to_string());
                        }
                    }
                }
            }
        }
    }
    
    None
}

/// 同步域名信息并更新数据库
#[command]
pub async fn sync_domain_info(domain_id: i64, domain: String) -> Result<DomainInfoResult, String> {
    let result = fetch_domain_info(domain.clone()).await?;
    
    // 更新数据库中的域名信息
    if result.expiry_date.is_some() || result.registrar.is_some() {
        use crate::database::get_db_pool;
        
        let pool = get_db_pool().await.map_err(|e| e.to_string())?;
        
        // 构建动态更新查询 - 修复参数绑定顺序问题
        // 使用固定顺序：expiry_date, registrar, registration_date
        let has_expiry = result.expiry_date.is_some();
        let has_registrar = result.registrar.is_some();
        let has_reg_date = result.registration_date.is_some();
        
        if has_expiry || has_registrar || has_reg_date {
            let mut set_clauses = Vec::new();
            
            if has_expiry {
                set_clauses.push("expiry_date = ?");
            }
            if has_registrar {
                set_clauses.push("registrar = ?");
            }
            if has_reg_date {
                set_clauses.push("registration_date = ?");
            }
            set_clauses.push("updated_at = CURRENT_TIMESTAMP");
            
            let query = format!(
                "UPDATE domains SET {} WHERE id = ?",
                set_clauses.join(", ")
            );
            
            let mut sql = sqlx::query(&query);
            
            // 必须按固定顺序绑定参数
            if let Some(ref expiry) = result.expiry_date {
                sql = sql.bind(expiry);
            }
            if let Some(ref registrar) = result.registrar {
                sql = sql.bind(registrar);
            }
            if let Some(ref reg_date) = result.registration_date {
                sql = sql.bind(reg_date);
            }
            
            sql = sql.bind(domain_id);
            
            let result = sql.execute(&pool)
                .await
                .map_err(|e| e.to_string())?;
            
            println!("Updated {} row(s) for domain_id {}", result.rows_affected(), domain_id);
        }
    }
    
    Ok(result)
}
