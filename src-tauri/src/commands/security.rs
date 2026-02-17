use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;
use chrono::{Utc, Duration, NaiveDateTime};

/// 安全概览统计
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityOverview {
    pub total_items: i64,
    
    // 轮换提醒统计
    pub rotation_overdue: i64,
    pub rotation_warning: i64,
    pub rotation_normal: i64,
    
    // 过期提醒统计
    pub expiry_overdue: i64,
    pub expiry_warning: i64,
    pub expiry_normal: i64,
    
    // 分类统计
    pub api_keys_count: i64,
    pub servers_count: i64,
    pub databases_count: i64,
    pub chrome_count: i64,
    pub domains_count: i64,
    pub certificates_count: i64,
}

/// 安全提醒项
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityAlert {
    pub id: i64,
    pub alert_type: String,  // 'rotation', 'expiry'
    pub severity: String,    // 'overdue', 'warning', 'normal'
    pub title: String,
    pub description: String,
    pub due_date: Option<String>,
    pub item_id: i64,
    pub item_category: String,
}

/// 更新 vault 项的安全设置
#[command]
pub async fn update_vault_item_security(
    id: i64,
    last_rotated_at: Option<String>,
    enable_rotation_reminder: Option<bool>,
    rotation_reminder_days: Option<i32>,
    api_expires_at: Option<String>,
    enable_expiry_alert: Option<bool>,
    expiry_alert_days: Option<i32>,
) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query(
        r#"
        UPDATE vault 
        SET last_rotated_at = ?,
            enable_rotation_reminder = ?,
            rotation_reminder_days = ?,
            api_expires_at = ?,
            enable_expiry_alert = ?,
            expiry_alert_days = ?,
            last_modified = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(last_rotated_at)
    .bind(enable_rotation_reminder.map(|v| if v { 1 } else { 0 }))
    .bind(rotation_reminder_days)
    .bind(api_expires_at)
    .bind(enable_expiry_alert.map(|v| if v { 1 } else { 0 }))
    .bind(expiry_alert_days)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 获取安全概览
#[command]
pub async fn get_security_overview() -> Result<SecurityOverview, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    let now = Utc::now();
    let warning_date = (now + Duration::days(7)).format("%Y-%m-%d").to_string();
    let normal_date = (now + Duration::days(30)).format("%Y-%m-%d").to_string();
    
    // 获取轮换提醒统计
    let rotation_stats: (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(CASE WHEN enable_rotation_reminder = 1 
                AND last_rotated_at IS NOT NULL 
                AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') < date('now') 
                THEN 1 END) as overdue,
            COUNT(CASE WHEN enable_rotation_reminder = 1 
                AND last_rotated_at IS NOT NULL 
                AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') >= date('now')
                AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') <= ? 
                THEN 1 END) as warning,
            COUNT(CASE WHEN enable_rotation_reminder = 1 
                AND last_rotated_at IS NOT NULL 
                AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') > ? 
                THEN 1 END) as normal
        FROM vault
        WHERE is_archived = 0
        "#
    )
    .bind(&warning_date)
    .bind(&normal_date)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 获取过期提醒统计
    let expiry_stats: (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(CASE WHEN enable_expiry_alert = 1 
                AND api_expires_at IS NOT NULL 
                AND date(api_expires_at) < date('now') 
                THEN 1 END) as overdue,
            COUNT(CASE WHEN enable_expiry_alert = 1 
                AND api_expires_at IS NOT NULL 
                AND date(api_expires_at) >= date('now')
                AND date(api_expires_at) <= ? 
                THEN 1 END) as warning,
            COUNT(CASE WHEN enable_expiry_alert = 1 
                AND api_expires_at IS NOT NULL 
                AND date(api_expires_at) > ? 
                THEN 1 END) as normal
        FROM vault
        WHERE is_archived = 0
        "#
    )
    .bind(&warning_date)
    .bind(&normal_date)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 获取分类统计
    let category_stats: (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(CASE WHEN category = 'API' THEN 1 END) as api_keys,
            COUNT(CASE WHEN category = 'Server' THEN 1 END) as servers,
            COUNT(CASE WHEN category = 'Database' THEN 1 END) as databases,
            COUNT(CASE WHEN category = 'Chrome' THEN 1 END) as chrome
        FROM vault
        WHERE is_archived = 0
        "#
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 获取域名统计
    let domain_stats: (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expiry_date) < date('now') THEN 1 END) as overdue,
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expiry_date) >= date('now') AND date(expiry_date) <= ? THEN 1 END) as warning,
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expiry_date) > ? THEN 1 END) as normal
        FROM domains
        "#
    )
    .bind(&warning_date)
    .bind(&normal_date)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // 获取证书统计
    let cert_stats: (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expires_at) < date('now') THEN 1 END) as overdue,
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expires_at) >= date('now') AND date(expires_at) <= ? THEN 1 END) as warning,
            COUNT(CASE WHEN enable_expiry_alert = 1 AND date(expires_at) > ? THEN 1 END) as normal
        FROM ssl_certificates
        "#
    )
    .bind(&warning_date)
    .bind(&normal_date)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let total_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vault WHERE is_archived = 0"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(SecurityOverview {
        total_items,
        rotation_overdue: rotation_stats.0,
        rotation_warning: rotation_stats.1,
        rotation_normal: rotation_stats.2,
        expiry_overdue: expiry_stats.0 + domain_stats.0 + cert_stats.0,
        expiry_warning: expiry_stats.1 + domain_stats.1 + cert_stats.1,
        expiry_normal: expiry_stats.2 + domain_stats.2 + cert_stats.2,
        api_keys_count: category_stats.0,
        servers_count: category_stats.1,
        databases_count: category_stats.2,
        chrome_count: category_stats.3,
        domains_count: domain_stats.0 + domain_stats.1 + domain_stats.2,
        certificates_count: cert_stats.0 + cert_stats.1 + cert_stats.2,
    })
}

/// 获取安全提醒列表
#[command]
pub async fn get_security_alerts() -> Result<Vec<SecurityAlert>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    let now = Utc::now();
    let warning_date = (now + Duration::days(7)).format("%Y-%m-%d").to_string();
    
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            title,
            category,
            last_rotated_at,
            rotation_reminder_days,
            enable_rotation_reminder,
            api_expires_at,
            enable_expiry_alert
        FROM vault
        WHERE is_archived = 0
        AND (
            (enable_rotation_reminder = 1 
             AND last_rotated_at IS NOT NULL 
             AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') <= ?)
            OR
            (enable_expiry_alert = 1 
             AND api_expires_at IS NOT NULL 
             AND date(api_expires_at) <= ?)
        )
        ORDER BY 
            CASE 
                WHEN enable_expiry_alert = 1 AND date(api_expires_at) < date('now') THEN 0
                WHEN enable_rotation_reminder = 1 AND date(last_rotated_at, '+' || rotation_reminder_days || ' days') < date('now') THEN 1
                ELSE 2
            END,
            COALESCE(api_expires_at, date(last_rotated_at, '+' || rotation_reminder_days || ' days'))
        "#
    )
    .bind(&warning_date)
    .bind(&warning_date)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut alerts = Vec::new();
    
    for row in rows {
        let id: i64 = row.get("id");
        let title: String = row.get("title");
        let category: String = row.get("category");
        let last_rotated_at: Option<String> = row.get("last_rotated_at");
        let rotation_reminder_days: Option<i32> = row.get("rotation_reminder_days");
        let enable_rotation_reminder: Option<i32> = row.get("enable_rotation_reminder");
        let api_expires_at: Option<String> = row.get("api_expires_at");
        let enable_expiry_alert: Option<i32> = row.get("enable_expiry_alert");
        
        // 检查轮换提醒
        if enable_rotation_reminder == Some(1) {
            if let (Some(rotated_at), Some(days)) = (last_rotated_at, rotation_reminder_days) {
                if let Ok(rotated) = NaiveDateTime::parse_from_str(&rotated_at, "%Y-%m-%d %H:%M:%S") {
                    let due = rotated + Duration::days(days as i64);
                    let due_str = due.format("%Y-%m-%d").to_string();
                    
                    let severity = if due < now.naive_utc() {
                        "overdue"
                    } else if due <= NaiveDateTime::parse_from_str(&format!("{} 00:00:00", warning_date), "%Y-%m-%d %H:%M:%S").unwrap_or(due) {
                        "warning"
                    } else {
                        "normal"
                    };
                    
                    alerts.push(SecurityAlert {
                        id: alerts.len() as i64 + 1,
                        alert_type: "rotation".to_string(),
                        severity: severity.to_string(),
                        title: format!("{} - 密码轮换提醒", title),
                        description: format!("建议每 {} 天轮换一次密码", days),
                        due_date: Some(due_str),
                        item_id: id,
                        item_category: category.clone(),
                    });
                }
            }
        }
        
        // 检查过期提醒
        if enable_expiry_alert == Some(1) {
            if let Some(expires) = api_expires_at {
                let severity = if &expires < &now.format("%Y-%m-%d").to_string() {
                    "overdue"
                } else if &expires <= &warning_date {
                    "warning"
                } else {
                    "normal"
                };
                
                alerts.push(SecurityAlert {
                    id: alerts.len() as i64 + 1,
                    alert_type: "expiry".to_string(),
                    severity: severity.to_string(),
                    title: format!("{} - API 即将过期", title),
                    description: "API Key 即将到达过期时间".to_string(),
                    due_date: Some(expires),
                    item_id: id,
                    item_category: category,
                });
            }
        }
    }
    
    // 获取服务器租期到期提醒
    let server_rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.notes
        FROM vault v
        WHERE v.is_archived = 0
        AND v.category = 'Server'
        AND v.notes IS NOT NULL
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    for row in server_rows {
        let id: i64 = row.get("id");
        let title: String = row.get("title");
        let notes_json: Option<String> = row.get("notes");
        
        if let Some(notes) = notes_json {
            if let Ok(server_data) = serde_json::from_str::<serde_json::Value>(&notes) {
                // 检查服务器租期
                if let (Some(false), Some(end_date)) = (
                    server_data.get("server_is_permanent").and_then(|v| v.as_bool()),
                    server_data.get("server_end_date").and_then(|v| v.as_str())
                ) {
                    if let Ok(expiry) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", end_date), "%Y-%m-%d %H:%M:%S") {
                        let alert_days = server_data.get("server_expiry_alert_days")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(30);
                        
                        let alert_date = expiry - Duration::days(alert_days);
                        
                        if now.naive_utc() >= alert_date {
                            let severity = if now.naive_utc() > expiry {
                                "overdue"
                            } else if now.naive_utc() >= expiry - Duration::days(7) {
                                "warning"
                            } else {
                                "normal"
                            };
                            
                            alerts.push(SecurityAlert {
                                id: alerts.len() as i64 + 1,
                                alert_type: "server".to_string(),
                                severity: severity.to_string(),
                                title: format!("{} - 服务器租期到期", title),
                                description: format!("服务器租期将于 {} 到期", end_date),
                                due_date: Some(end_date.to_string()),
                                item_id: id,
                                item_category: "Server".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    // 获取数据库服务租期到期提醒
    let db_rows = sqlx::query(
        r#"
        SELECT v.id, v.title, v.notes
        FROM vault v
        WHERE v.is_archived = 0
        AND v.category = 'Database'
        AND v.notes IS NOT NULL
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    for row in db_rows {
        let id: i64 = row.get("id");
        let title: String = row.get("title");
        let notes_json: Option<String> = row.get("notes");
        
        if let Some(notes) = notes_json {
            if let Ok(db_data) = serde_json::from_str::<serde_json::Value>(&notes) {
                // 检查数据库服务租期
                if let (Some(false), Some(end_date)) = (
                    db_data.get("service_is_permanent").and_then(|v| v.as_bool()),
                    db_data.get("service_end_date").and_then(|v| v.as_str())
                ) {
                    if let Ok(expiry) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", end_date), "%Y-%m-%d %H:%M:%S") {
                        let alert_days = db_data.get("service_expiry_alert_days")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(30);
                        
                        let alert_date = expiry - Duration::days(alert_days);
                        
                        if now.naive_utc() >= alert_date {
                            let severity = if now.naive_utc() > expiry {
                                "overdue"
                            } else if now.naive_utc() >= expiry - Duration::days(7) {
                                "warning"
                            } else {
                                "normal"
                            };
                            
                            alerts.push(SecurityAlert {
                                id: alerts.len() as i64 + 1,
                                alert_type: "database".to_string(),
                                severity: severity.to_string(),
                                title: format!("{} - 数据库服务到期", title),
                                description: format!("数据库服务将于 {} 到期", end_date),
                                due_date: Some(end_date.to_string()),
                                item_id: id,
                                item_category: "Database".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    // 获取域名到期提醒
    let domain_rows = sqlx::query(
        r#"
        SELECT id, domain, expiry_date, expiry_alert_days
        FROM domains
        WHERE enable_expiry_alert = 1
        AND expiry_date IS NOT NULL
        AND date(expiry_date) <= date('now', '+30 days')
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    for row in domain_rows {
        let id: i64 = row.get("id");
        let domain: String = row.get("domain");
        let expiry_date: String = row.get("expiry_date");
        let alert_days: i32 = row.get("expiry_alert_days");
        
        if let Ok(expiry) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", expiry_date), "%Y-%m-%d %H:%M:%S") {
            let alert_date = expiry - Duration::days(alert_days as i64);
            
            if now.naive_utc() >= alert_date {
                let severity = if now.naive_utc() > expiry {
                    "overdue"
                } else if now.naive_utc() >= expiry - Duration::days(7) {
                    "warning"
                } else {
                    "normal"
                };
                
                alerts.push(SecurityAlert {
                    id: alerts.len() as i64 + 1,
                    alert_type: "domain".to_string(),
                    severity: severity.to_string(),
                    title: format!("{} - 域名到期", domain),
                    description: format!("域名将于 {} 到期", expiry_date),
                    due_date: Some(expiry_date),
                    item_id: id,
                    item_category: "Domain".to_string(),
                });
            }
        }
    }
    
    // 获取SSL证书到期提醒
    let cert_rows = sqlx::query(
        r#"
        SELECT id, cert_name, expires_at, expiry_alert_days
        FROM ssl_certificates
        WHERE enable_expiry_alert = 1
        AND expires_at IS NOT NULL
        AND date(expires_at) <= date('now', '+30 days')
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    for row in cert_rows {
        let id: i64 = row.get("id");
        let cert_name: String = row.get("cert_name");
        let expires_at: String = row.get("expires_at");
        let alert_days: i32 = row.get("expiry_alert_days");
        
        if let Ok(expiry) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", expires_at), "%Y-%m-%d %H:%M:%S") {
            let alert_date = expiry - Duration::days(alert_days as i64);
            
            if now.naive_utc() >= alert_date {
                let severity = if now.naive_utc() > expiry {
                    "overdue"
                } else if now.naive_utc() >= expiry - Duration::days(7) {
                    "warning"
                } else {
                    "normal"
                };
                
                alerts.push(SecurityAlert {
                    id: alerts.len() as i64 + 1,
                    alert_type: "certificate".to_string(),
                    severity: severity.to_string(),
                    title: format!("{} - SSL证书过期", cert_name),
                    description: format!("SSL证书将于 {} 过期", expires_at),
                    due_date: Some(expires_at),
                    item_id: id,
                    item_category: "Certificate".to_string(),
                });
            }
        }
    }
    
    Ok(alerts)
}
