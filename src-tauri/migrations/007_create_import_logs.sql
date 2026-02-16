-- 007_create_import_logs.sql
-- 导入操作日志表和增强临时表

-- 导入操作日志
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

CREATE INDEX IF NOT EXISTS idx_import_logs_batch_id ON import_logs(batch_id);

-- 删除旧表，重建带批次和状态的临时表
DROP TABLE IF EXISTS chrome_imported_passwords;

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

CREATE INDEX IF NOT EXISTS idx_chrome_import_batch ON chrome_imported_passwords(batch_id);
CREATE INDEX IF NOT EXISTS idx_chrome_import_status ON chrome_imported_passwords(status);
