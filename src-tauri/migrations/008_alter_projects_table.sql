-- 008_alter_projects_table.sql
-- 扩展 projects 表，添加项目详情字段

-- 添加新列（如果表已存在）
ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN arch_desc TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN readme_path TEXT;
ALTER TABLE projects ADD COLUMN urls_json TEXT DEFAULT '[]';
