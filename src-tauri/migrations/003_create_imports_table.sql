-- 003_create_imports_table.sql
CREATE TABLE IF NOT EXISTS chrome_imported_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_url TEXT,
  username TEXT,
  password TEXT,
  vault_item_id INTEGER,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (vault_item_id) REFERENCES vault(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imports_vault_item ON chrome_imported_passwords(vault_item_id);
CREATE INDEX IF NOT EXISTS idx_imports_origin ON chrome_imported_passwords(origin_url);
