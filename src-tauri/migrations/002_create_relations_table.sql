-- 002_create_relations_table.sql
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

CREATE INDEX IF NOT EXISTS idx_relations_credential ON credential_project_relations(credential_id);
CREATE INDEX IF NOT EXISTS idx_relations_project ON credential_project_relations(project_id);
