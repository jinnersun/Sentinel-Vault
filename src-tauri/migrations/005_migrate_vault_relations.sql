-- 005_migrate_vault_relations.sql
-- 1) 创建 Default 项目（如果不存在）
INSERT INTO projects (name, color)
SELECT 'Default', '#10b981'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Default');

-- 2) 获取 Default 项目 id
-- 3) 对每个 vault 条目创建 credential_project_relations（如果不存在）
INSERT INTO credential_project_relations (credential_id, project_id, relation_type, metadata, created_at)
SELECT v.id, p.id, 'migrated_default', '{}', CURRENT_TIMESTAMP
FROM vault v
CROSS JOIN (SELECT id FROM projects WHERE name = 'Default' LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM credential_project_relations r WHERE r.credential_id = v.id
);

-- 备注: 这是一次性迁移脚本，安全可重复（使用 WHERE NOT EXISTS 避免重复插入）。
