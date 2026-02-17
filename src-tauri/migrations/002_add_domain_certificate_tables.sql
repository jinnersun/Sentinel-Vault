-- 002_add_domain_certificate_tables.sql
-- 添加域名管理和SSL证书管理表
-- 包含：domains, ssl_certificates, domain_server_relations, certificate_domain_relations

-- ============================================
-- 1. 基础表（无依赖）
-- ============================================

-- domains 表：域名管理
CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,                    -- 域名
    registrar TEXT,                          -- 注册商
    registration_date TEXT,                  -- 注册时间
    expiry_date TEXT,                        -- 到期时间
    enable_expiry_alert BOOLEAN DEFAULT 1,   -- 是否启用到期提醒
    expiry_alert_days INTEGER DEFAULT 30,    -- 到期前提醒天数
    notes TEXT,                              -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ssl_certificates 表：SSL证书管理
CREATE TABLE IF NOT EXISTS ssl_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_name TEXT NOT NULL,                 -- 证书名称
    domains TEXT,                            -- 证书包含的域名列表（JSON数组）
    issuer TEXT,                             -- 颁发机构
    issued_at TEXT,                          -- 生效时间
    expires_at TEXT NOT NULL,                -- 过期时间
    enable_expiry_alert BOOLEAN DEFAULT 1,   -- 是否启用过期提醒
    expiry_alert_days INTEGER DEFAULT 30,    -- 过期前提醒天数
    cert_file_path TEXT,                     -- 证书文件路径
    key_file_path TEXT,                      -- 私钥文件路径
    chain_file_path TEXT,                    -- 证书链文件路径
    notes TEXT,                              -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 关联表（依赖基础表）
-- ============================================

-- domain_server_relations：域名与服务器的多对多关联
CREATE TABLE IF NOT EXISTS domain_server_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL,
    server_id INTEGER NOT NULL,              -- 关联的vault.id（category='Server'）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES vault(id) ON DELETE CASCADE,
    UNIQUE(domain_id, server_id)
);

-- certificate_domain_relations：证书与域名的多对多关联
CREATE TABLE IF NOT EXISTS certificate_domain_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id INTEGER NOT NULL,
    domain_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (certificate_id) REFERENCES ssl_certificates(id) ON DELETE CASCADE,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
    UNIQUE(certificate_id, domain_id)
);

-- ============================================
-- 3. 索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_expiry ON domains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_expires ON ssl_certificates(expires_at);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_domains ON ssl_certificates(domains);
CREATE INDEX IF NOT EXISTS idx_domain_server_domain ON domain_server_relations(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_server_server ON domain_server_relations(server_id);
CREATE INDEX IF NOT EXISTS idx_cert_domain_cert ON certificate_domain_relations(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_domain_domain ON certificate_domain_relations(domain_id);
