-- 001_init_database.sql
-- 初始化所有数据库表结构
-- 包含：vault, projects, settings, credential_project_relations, api_keys_registry, vault_history, import_logs, chrome_imported_passwords

-- ============================================
-- 1. 基础表（无依赖）
-- ============================================

-- vault 表：凭证存储（核心表）
CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    category TEXT DEFAULT 'Password',
    project_id INTEGER,
    color TEXT DEFAULT '#3b82f6',
    favicon_url TEXT,
    is_archived INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 安全相关字段（轮换提醒 + API 有效期）
    last_rotated_at TIMESTAMP,
    enable_rotation_reminder BOOLEAN DEFAULT 0,
    rotation_reminder_days INTEGER DEFAULT 90,
    api_expires_at TIMESTAMP,
    enable_expiry_alert BOOLEAN DEFAULT 0,
    expiry_alert_days INTEGER DEFAULT 7
);

-- projects 表：项目管理
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#10b981',
    description TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    arch_desc TEXT DEFAULT '',
    readme_path TEXT,
    urls_json TEXT DEFAULT '[]'
);

-- settings 表：应用设置
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ============================================
-- 2. 关联表（依赖基础表）
-- ============================================

-- credential_project_relations：凭证与项目的多对多关联
CREATE TABLE IF NOT EXISTS credential_project_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credential_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'direct',
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (credential_id) REFERENCES vault(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- api_keys_registry：API 密钥管理
CREATE TABLE IF NOT EXISTS api_keys_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_value TEXT NOT NULL,
    owner_id INTEGER,
    scope TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- vault_history：密码变更历史
CREATE TABLE IF NOT EXISTS vault_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id INTEGER NOT NULL,
    old_secret_encrypted TEXT NOT NULL,
    new_secret_encrypted TEXT,
    change_reason TEXT,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(vault_id) REFERENCES vault(id) ON DELETE CASCADE
);

-- import_logs：导入操作日志
CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    total_count INTEGER,
    new_count INTEGER,
    conflict_count INTEGER,
    identical_count INTEGER,
    skipped_count INTEGER,
    updated_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- chrome_imported_passwords：Chrome 密码导入临时存储
CREATE TABLE IF NOT EXISTS chrome_imported_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    origin_url TEXT,
    username TEXT,
    password TEXT,
    status TEXT,  -- 'New' | 'Conflict' | 'Identical' | 'Processed'
    existing_vault_id INTEGER,
    existing_password TEXT,
    decision TEXT,  -- 'update' | 'skip' | null
    FOREIGN KEY(existing_vault_id) REFERENCES vault(id)
);

-- ============================================
-- 3. 索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vault_category ON vault(category);
CREATE INDEX IF NOT EXISTS idx_vault_archived ON vault(is_archived);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_relations_credential ON credential_project_relations(credential_id);
CREATE INDEX IF NOT EXISTS idx_relations_project ON credential_project_relations(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys_registry(name);
CREATE INDEX IF NOT EXISTS idx_vault_history_vault_id ON vault_history(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_history_created_at ON vault_history(created_at);
CREATE INDEX IF NOT EXISTS idx_import_logs_batch_id ON import_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_chrome_import_batch ON chrome_imported_passwords(batch_id);

-- ============================================
-- 4. 默认数据
-- ============================================

-- 插入默认项目（如果不存在）
INSERT INTO projects (name, color)
SELECT 'Default', '#10b981'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Default');
