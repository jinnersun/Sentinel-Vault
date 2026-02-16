-- 004_create_api_keys_table.sql
CREATE TABLE IF NOT EXISTS api_keys_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  owner_id INTEGER,
  scope TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys_registry(name);
