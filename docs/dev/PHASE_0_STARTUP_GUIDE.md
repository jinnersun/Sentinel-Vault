# 🚀 Phase 0 启动指南 - V2 架构数据库迁移

**概览**: Phase 0是V2架构过渡的关键步骤，涉及数据库表结构重设计和数据迁移。这一阶段将建立新的independent information model。

**时间估计**: ~4-6小时  
**难度**: 中等  
**风险级别**: 🟢 低 (包含完整回滚计划)  
**起始日期**: [待确认]

---

## 📋 快速清单

- [ ] 1️⃣ 环境检查和备份
- [ ] 2️⃣ SQL迁移脚本审查
- [ ] 3️⃣ 执行表创建
- [ ] 4️⃣ 数据迁移
- [ ] 5️⃣ 验证完整性
- [ ] 6️⃣ 提交变更

---

## ✅ 步骤1: 环境检查和备份

### 1.1 环境校验
```bash
# 检查工作目录
cd d:\AI\个人\AIpassword
git status

# 验证当前分支（应该在main或dev）
git branch -v
```

### 1.2 创建功能分支
```bash
# 从main创建新分支
git checkout -b feature/p3-v2-database-migration

# 验证分支切换
git branch -v
```

### 1.3 数据库备份
**重要**: 在任何迁移前创建完整备份

```bash
# 备份文件位置（Tauri SQLite数据库）
# Windows: $env:APPDATA/devvault (或自定义应用数据目录)

# 手动备份步骤:
# 1. 打开应用数据目录: Win+R -> %APPDATA%/devvault
# 2. 复制 devvault.db 到安全位置
# 3. 记录备份时间戳: [timestamp]
```

**备份验证**:
- 文件大小 > 0 KB ✓
- 修改时间 = 当前时间 ✓
- 所有权限正确 ✓

---

## 📊 步骤2: SQL迁移脚本审查

### 2.1 新表结构概览

从 [`ARCHITECTURE_REDESIGN_V2.md`](ARCHITECTURE_REDESIGN_V2.md) Section 3.2 获取完整SQL。

**表操作顺序** (重要):
1. ✅ 创建 `projects` 表
2. ✅ 创建 `credential_project_relations` 表  
3. ✅ 创建 `chrome_imported_passwords` 表
4. ✅ (可选) 创建 `api_keys_registry` 表

### 2.2 迁移脚本位置

```
src-tauri/migrations/
├── 001_create_projects_table.sql
├── 002_create_relations_table.sql
├── 003_create_imports_table.sql
└── 004_create_api_keys_table.sql (可选)
```

**如果文件不存在**: 从 ARCHITECTURE_REDESIGN_V2.md Section 3.2 复制SQL

### 2.3 脚本验证清单
- [ ] 所有CREATE TABLE语句包含 IF NOT EXISTS
- [ ] 所有外键约束有 ON DELETE CASCADE
- [ ] timestamp字段包含DEFAULT CURRENT_TIMESTAMP
- [ ] 枚举类型正确 (credential_type, relation_type等)

---

## ⚙️ 步骤3: 执行表创建

### 3.1 Rust代码审查

打开 [`src-tauri/src/database.rs`](src-tauri/src/database.rs)

需要添加的函数 (从IMPLEMENTATION_PLAN_V2_UPDATED.md获取):
```rust
// 新增函数签名
pub async fn init_v2_tables(pool: &SqlitePool) -> Result<()>  
pub async fn create_project(pool: &SqlitePool, project: &NewProject) -> Result<i64>
pub async fn create_credential_project_relation(...) -> Result<()>
pub async fn migrate_existing_project_relations(...) -> Result<()>
```

### 3.2 编译检查

```bash
# 进入Rust项目目录
cd src-tauri

# 检查编译
cargo build --release

# 预期结果:
# - Compiling devvault v0.2.0
# - Finished `release` [optimized] target(s) in X.XXs
# ✓ 无错误
```

**如果有编译错误**:
1. 检查缺失的导入 (use statements)
2. 验证所有新结构体都在 models 中定义
3. 参考: [`IMPLEMENTATION_PLAN_V2_UPDATED.md` Section 5.1](IMPLEMENTATION_PLAN_V2_UPDATED.md#51-rust-后端实现)

### 3.3 执行迁移

```bash
# 在应用启动时调用 (main.rs中的初始化)
# 或通过Tauri命令手动触发

# Tauri命令:
// 前端调用
await invoke('init_v2_database', {})
```

**成功指标**:
- 应用正常启动（无数据库错误）
- SQLite日志显示4个新表已创建
- 应用可以进行任何操作但不会崩溃

---

## 🔄 步骤4: 数据迁移

### 4.1 现有数据映射

**从P0现状理解**:
- vault_items 表已存在，包含密码、API密钥等
- 当前没有project_id字段（或有但不使用）
- 需要创建"Default"项目来容纳所有现有凭证

### 4.2 迁移策略

```javascript
// 前端迁移逻辑流程 (或Rust后端)
1. 创建"Default"项目 (id: 0)
   - name: "Default", 
   - description: "Auto-created from P0 vault"
   
2. 对于vault_items中每个条目:
   - 读取条目
   - 在projects表中记录其"虚拟项目"（如果有）
   - 创建credential_project_relations记录
   
3. 对于Chrome导入历史:
   - 如果vault_items.chrome_imported == true
   - 在chrome_imported_passwords中创建记录
```

### 4.3 迁移脚本

从 [`IMPLEMENTATION_PLAN_V2_UPDATED.md` Section 5.2](IMPLEMENTATION_PLAN_V2_UPDATED.md#52-数据迁移脚本) 获取完整迁移SQL：

```sql
-- 1. 创建默认项目
INSERT INTO projects (name, description, created_at)
VALUES ('Default', 'Auto-created from P0 vault', CURRENT_TIMESTAMP)
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Default');

-- 2. 迁移现有关系
INSERT INTO credential_project_relations (credential_id, project_id, relation_type, created_at)
SELECT id, (SELECT id FROM projects WHERE name = 'Default'), 'direct', CURRENT_TIMESTAMP
FROM vault_items
WHERE NOT EXISTS (
  SELECT 1 FROM credential_project_relations 
  WHERE credential_id = vault_items.id
);

-- 3. 迁移导入历史
-- [完整SQL见ARCHITECTURE_REDESIGN_V2.md]
```

### 4.4 验证迁移

```sql
-- 查询新表记录数
SELECT 'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'credential_project_relations', COUNT(*) FROM credential_project_relations
UNION ALL
SELECT 'chrome_imported_passwords', COUNT(*) FROM chrome_imported_passwords;

-- 预期结果:
-- projects: >= 1 (至少有Default项目)
-- credential_project_relations: = vault_items的总数
-- chrome_imported_passwords: >= 0
```

---

## ✔️ 步骤5: 完整性验证

### 5.1 数据一致性检查

```sql
-- 检查1: 所有credential都有项目关联
SELECT COUNT(*) as orphan_credentials
FROM vault_items vi
WHERE NOT EXISTS (
  SELECT 1 FROM credential_project_relations cpr 
  WHERE cpr.credential_id = vi.id
);
-- 预期结果: 0

-- 检查2: 没有悬挂的项目关联
SELECT COUNT(*) as invalid_relations
FROM credential_project_relations cpr
WHERE NOT EXISTS (SELECT 1 FROM vault_items vi WHERE vi.id = cpr.credential_id)
   OR NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = cpr.project_id);
-- 预期结果: 0

-- 检查3: 导入记录完整性
SELECT COUNT(*) as mismatched_imports
FROM chrome_imported_passwords cip
WHERE cip.vault_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM vault_items vi WHERE vi.id = cip.vault_item_id);
-- 预期结果: 0
```

### 5.2 功能测试

在应用中测试:
- [ ] 能够列出所有凭证（来自Default项目）
- [ ] 能够创建新项目
- [ ] 能够创建新凭证并关联到项目
- [ ] 能够修改现有凭证而不丢失数据
- [ ] 能够删除凭证（检查级联删除）

### 5.3 性能基准测试

```javascript
// 在Chrome DevTools中测试
console.time('load-credentials');
const creds = await invoke('query_credentials', {});
console.timeEnd('load-credentials');
// 预期: < 100ms (对于< 1000条记录)
```

---

## 🔙 步骤6: 提交变更

### 6.1 代码审查清单

在提交前验证:
- [ ] 所有新函数都有文档注释
- [ ] Rust代码通过 `cargo clippy` 检查
- [ ] 前端代码通过 TypeScript检查
- [ ] 没有调试日志或临时代码

```bash
# Rust检查
cd src-tauri
cargo clippy -- -D warnings

# TypeScript检查  
cd ..
npm run check  # 如果有配置
```

### 6.2 Git提交

```bash
# 查看变更
git status
git diff --stat

# 分阶段提交（保持清晰的提交历史）
# 提交1: 添加数据库migrations
git add src-tauri/migrations/
git commit -m "database: add V2 schema migration scripts

- Create projects table for independent project management
- Create credential_project_relations for N:N associations
- Create chrome_imported_passwords for import history
- Create api_keys_registry for optional API key management

BREAKING: Database structure changes, backup required before upgrade"

# 提交2: 更新Rust代码
git add src-tauri/src/database.rs src-tauri/src/models.rs
git commit -m "database: implement V2 schema operations

- Add database initialization for new tables
- Implement CRUD operations for projects
- Implement relation management
- Add data migration utilities"

# 提交3: 文档更新
git add docs/
git commit -m "docs: mark V1 implementation plan as deprecated

- Direct users to IMPLEMENTATION_PLAN_V2_UPDATED.md
- Keep V1 documents for historical reference"
```

### 6.3 推送和验证

```bash
# 推送功能分支
git push origin feature/p3-v2-database-migration

# 在GitHub上创建Pull Request
# PR标题: "feat: Implement V2 database schema migration"
# PR描述: [从COMPLETION_SUMMARY_ARCHITECTURE_V2.md复制总结]

# PR检查清单:
# - [ ] CI/CD通过（如有配置）
# - [ ] 代码审查批准
# - [ ] 测试通过
# - [ ] 文档更新完成
```

### 6.4 主分支合并

```bash
# 切回主分支
git checkout main

# 拉取最新更改
git pull origin main

# 合并功能分支
git merge feature/p3-v2-database-migration

# 推送到GitHub
git push origin main

# 创建Release标记
git tag -a v0.2.1-phase0 -m "Phase 0: V2 Database Architecture Migration"
git push origin v0.2.1-phase0
```

---

## 🆘 故障排查

### 问题: SQLite数据库被锁定

**症状**: "database is locked" 错误

**解决**:
```bash
# 1. 确保应用没有运行
# 2. 检查没有其他进程访问数据库
# 3. 删除 .db-shm 和 .db-wal 文件
rm %APPDATA%/devvault/devvault.db-shm
rm %APPDATA%/devvault/devvault.db-wal

# 4. 重试迁移
```

### 问题: 迁移后应用崩溃

**症状**: 启动失败，日志显示"table not found"

**解决**:
1. **回滚**: 恢复备份数据库
2. **检查**: 验证所有SQL脚本执行成功
3. **修复**: 
   - 检查FOREIGN KEY是否正确
   - 验证列类型匹配
   - 确保NOT NULL约束有默认值

### 问题: 数据迁移后数据丢失

**症状**: vault_items中的某些条目不见了

**解决**:
1. **检查** orphan_credentials 查询结果 (应该 = 0)
2. **恢复**: 使用备份数据库
3. **复查**: 确保迁移逻辑包含所有条件

### 问题: 性能下降

**症状**: 查询变得缓慢

**解决**:
```sql
-- 1. 检查缺失的索引
EXPLAIN QUERY PLAN
SELECT * FROM credential_project_relations 
WHERE credential_id = 1;

-- 2. 添加缺失的索引 (参考ARCHITECTURE_REDESIGN_V2.md)
CREATE INDEX idx_credential_project_relations_credential_id 
ON credential_project_relations(credential_id);

-- 3. 分析统计信息
ANALYZE;
```

---

## 📚 相关文档

**必读**:
- [`ARCHITECTURE_REDESIGN_V2.md`](ARCHITECTURE_REDESIGN_V2.md) - 完整V2架构设计
- [`IMPLEMENTATION_PLAN_V2_UPDATED.md`](IMPLEMENTATION_PLAN_V2_UPDATED.md) - Phase 0-5实现细节
- [`MIGRATION_AND_IMPACT_ANALYSIS.md`](MIGRATION_AND_IMPACT_ANALYSIS.md) - 影响分析和风险评估

**参考**:
- [`ARCHITECTURE_QUICK_REFERENCE.md`](ARCHITECTURE_QUICK_REFERENCE.md) - 快速查询
- [`FINAL_CONFIRMATION_V2.md`](FINAL_CONFIRMATION_V2.md) - V2决策确认

---

## ✨ 完成标志

Phase 0成功完成的标志:
- ✅ 所有4个新表创建成功
- ✅ 现有数据完全迁移到新模型
- ✅ 数据一致性检查全部通过  
- ✅ 应用正常启动和运行
- ✅ 功能测试验证通过
- ✅ 代码已提交和推送
- ✅ Release标记已创建

---

## 🎯 下一步

Phase 0完成后，继续执行:

**Phase 1**: 后端API实现 (2-3天)
- 准备: 审查 [`IMPLEMENTATION_PLAN_V2_UPDATED.md` Section 5.1](IMPLEMENTATION_PLAN_V2_UPDATED.md#51-rust-后端实现)
- 任务: 实现15个Tauri命令
- 验证: 使用Postman或curl测试

**Phase 2**: 前端框架重设计 (2-3天)
- 准备: 审查UI/UX变更
- 任务: 更新导航、layout和context
- 验证: 手动UI测试

详见: [`IMPLEMENTATION_PLAN_V2_UPDATED.md`](IMPLEMENTATION_PLAN_V2_UPDATED.md)

---

## 📞 支持和反馈

如有问题或改进建议:
1. 检查 [故障排查](#-故障排查) 部分
2. 查看相关架构文档
3. 参考 Git commit历史了解变更意图

---

**最后更新**: 2024年  
**Phase 0 状态**: 🔵 待执行  
**大约完成时间**: [待确认] + 4-6小时
