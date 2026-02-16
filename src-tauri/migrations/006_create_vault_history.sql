-- 006_create_vault_history.sql
-- 密码变更历史记录表

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

CREATE INDEX IF NOT EXISTS idx_vault_history_vault_id ON vault_history(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_history_created_at ON vault_history(created_at);
