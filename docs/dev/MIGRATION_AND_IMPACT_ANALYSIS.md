# 📊 架构重设计 - 影响分析和迁移指南

**关键变更**: 从强关联架构 → 独立信息模型  
**影响范围**: 数据库 | 后端API | 前端UI | 业务流程  

---

## 🔄 架构对比

### 旧架构: 凭证-项目强关联

```
vault_items
├─ id, title, username, password
├─ project_id (FK → projects) 🔴 强制关联
├─ type, host, port...
└─ ...

问题:
❌ 凭证必须属于某个项目
❌ 无法存储通用/跨项目凭证  
❌ 无法有关联但不属于项目的凭证
❌ 项目删除凭证处理复杂
❌ API KEY无处安放
```

### 新架构: 完全信息独立

```
vault_items (独立)          projects (独立)
├─ id, title...             ├─ id, name...
├─ credentials data         ├─ project metadata
└─ (无project_id) ✅        └─ (无凭证)

            ↓ N:N关联 ↓

credential_project_relations
├─ credential_id, project_id
├─ relationship_type
└─ created_by, created_at

chrome_imported_passwords (独立)
├─ import_batch_id, origin...
├─ status (pending/imported/failed)
└─ optional vault_item_id

api_keys_registry (独立，可选)
├─ name, service_name
├─ api_key_encrypted
└─ scope, expiry_date

优势:
✅ 完全解耦，最大灵活性
✅ 支持N:N关联
✅ 凭证可独立存在
✅ 项目可以为空
✅ 完整的导入历史管理
✅ API KEY专用管理
```

---

## 📈 影响分析

### 1. 数据库迁移影响

#### vault_items 表变化

```sql
-- 移除字段
ALTER TABLE vault_items DROP COLUMN project_id;  -- 风险: 🟡 中等

-- 保留所有其他字段 ✅
-- 实际上没有添加新字段到 vault_items
```

**影响评估**:
- 🟢 低风险迁移 (仅移除一列)
- ⏱️ 迁移时间: < 1 小时
- 💾 无数据丢失 (数据转移到relations表)

#### 新增的表

| 表 | 行数预估 | 大小预估 | 复杂度 |
|-----|---------|---------|--------|
| projects | 10-100 | 50KB | 🟢 低 |
| credential_project_relations | 100-1000 | 100KB | 🟢 低 |
| chrome_imported_passwords | 1000+ | 1MB | 🟡 中 |
| api_keys_registry | 10-100 | 50KB | 🟢 低 |

**总体影响**: 🟢 低风险，低复杂度

---

### 2. 后端API影响

#### 原有命令受影响

```rust
// 旧接口
#[command]
pub async fn get_vault_items(
    project_id: String,  // 🔴 需要修改，变成可选
) -> Result<Vec<Credential>, String> { }

// 新接口 (Option 1: 向后兼容)
#[command]
pub async fn get_vault_items(
    project_id: Option<String>,  // ✅ 可选，为None时返回所有
) -> Result<Vec<Credential>, String> { }

// 新接口 (Option 2: 新命令)
#[command]
pub async fn get_all_credentials() -> Result<Vec<Credential>, String> { }

#[command]
pub async fn get_project_credentials(
    project_id: String,
) -> Result<Vec<Credential>, String> { }
```

#### 新增命令

```rust
// 项目管理
create_project()
update_project()
delete_project()
get_all_projects()

// 关联管理
associate_credential_to_project()      // 新
disassociate_credential_from_project() // 新
get_project_credentials()              // 新
get_credential_projects()              // 新

// 导入管理
get_chrome_import_history()            // 新
process_chrome_import_batch()          // 新
link_imported_password()               // 新

// API KEY管理 (可选)
create_api_key()                       // 新
get_api_keys_by_service()             // 新
rotate_api_key()                       // 新
```

**总体影响**:
- 🟡 中等改动 (6-8个现有命令需调整)
- 🟢 15+ 新命令需实现
- ⏱️ 实现时间: 3-4 天

---

### 3. 前端 UI 影响

#### 导航菜单重构

```tsx
// 旧架构 UI 结构
<MainLayout>
  <ProjectsList>
    <Project>
      <CredentialsList />  // 只显示该项目的凭证
```

// 新架构 UI 结构
<MainLayout>
  <VaultTab>           // 📝 新：凭证库总视图
    <AllCredentials />
    <UnassociatedCredentials />
  
  <ProjectsTab>        // 🏢 新：项目管理
    <ProjectsList />
    <ProjectDetails>
      <AssociatedCredentials />
  
  <ImportsTab>         // 📥 新：导入历史
    <ChromeImportHistory />
  
  <APIKeysTab>         // 🔑 新：API KEY管理 (可选)
    <APIKeysList />
```

**变更点**:
1. Sidebar 能从 3 个菜单变成 5+ 个菜单  ⏰ 1 天
2. 增加多个新视图 ⏰ 2-3 天
3. 凭证详情面板需要显示项目关系 ⏰ 1 天

**总体影响**: 🟡 中等改动, ⏱️ 4-5 天

---

### 4. 业务流程影响

#### 新增用户流程

| 流程 | 原有 | 新增 |
|------|------|------|
| 添加凭证 | 1. 输入凭证<br/>2. 选择项目<br/>3. 保存 | 1. 输入凭证<br/>2. 保存<br/>3. (可选) 关联项目 |
| 创建项目 | ❌ 不支持 | ✅ 1. 创建空项目<br/>2. 后续添加凭证 |
| 跨项目共享凭证 | ❌ 需要复制 | ✅ 1. 编辑凭证<br/>2. 添加更多项目 |
| 导入Chrome密码 | ❌ 混合在凭证中 | ✅ 1. 导入到历史表<br/>2. 检查冲突<br/>3. 创建凭证<br/>4. 关联项目 |

**优势**:
✅ 流程更清晰  
✅ 用户不需要创建虚拟项目  
✅ 支持更多场景  

---

## 🔧 实现计划调整

### 原计划 vs 新计划

#### 原计划 (使用旧架构)

```
Phase 1 (2天): 数据库字段扩展 + 基础API
├─ 添加 host, port, type 等字段
└─ 实现服务器/数据库的CRUD

Phase 2-5: 逐步实现功能
```

#### 新计划 (使用新架构)

```
Phase 0 (1天): 架构重设 + 数据迁移 ⭐ 新增
├─ 创建 projects 表
├─ 创建 credential_project_relations 表
├─ 创建 chrome_imported_passwords 表
├─ 从 vault_items 迁移数据
└─ 验证数据完整性

Phase 1 (2-3天): 后端 API 实现
├─ 实现新的 CRUD 命令
├─ 实现关联管理命令
├─ 实现导入历史命令
└─ 完整测试

Phase 2 (3-4天): 前端 UI 实现
├─ 重建导航和菜单
├─ 创建项目管理视图
├─ 创建导入历史视图
├─ 优化凭证详情面板
└─ 完整的 UI 测试

Phase 3-6: 逐步实现其他功能
```

**总工作量变化**:
- 原: 40-50 小时
- 新: 45-55 小时 (Phase 0 添加 ~5 小时)
- 影响: 🟡 +5-10 小时，但获得更强的架构

---

## 🗂️ 文件结构更新

### 数据库相关

```
src-tauri/src/
├─ database.rs (修改)
│  ├─ vault_items 表操作 (修改)
│  ├─ projects 表操作 (新)
│  ├─ credential_project_relations 操作 (新)
│  ├─ chrome_imported_passwords 操作 (新)
│  └─ api_keys_registry 操作 (新, 可选)
│
├─ models.rs (新/修改)
│  ├─ Credential struct (修改，无project_id)
│  ├─ Project struct (新)
│  ├─ CredentialProjectRelation struct (新)
│  ├─ ChromeImportRecord struct (新)
│  └─ ApiKey struct (新, 可选)
│
└─ migrations/ (新目录)
   ├─ 001_create_projects.sql
   ├─ 002_create_relations.sql
   ├─ 003_create_chrome_imports.sql
   ├─ 004_migrate_vault_items.sql
   └─ 005_create_api_keys.sql (可选)
```

### 前端相关

```
src/
├─ contexts/
│  ├─ AppContext.tsx (修改)
│  ├─ ProjectContext.tsx (新)
│  └─ ImportContext.tsx (新)
│
├─ components/
│  ├─ VaultView/ (新目录)
│  │  ├─ AllCredentials.tsx
│  │  └─ UnassociatedCredentials.tsx
│  │
│  ├─ ProjectsView/ (新目录)
│  │  ├─ ProjectsList.tsx
│  │  ├─ ProjectCreate.tsx
│  │  └─ ProjectDetails.tsx
│  │
│  ├─ ImportsView/ (新目录)
│  │  ├─ ChromeImportHistory.tsx
│  │  └─ ImportProcessing.tsx
│  │
│  ├─ APIKeysView/ (新目录, 可选)
│  │  ├─ APIKeysList.tsx
│  │  └─ APIKeyModal.tsx
│  │
│  └─ Shared/
│     ├─ CredentialDetailsPanel.tsx (修改)
│     └─ ProjectAssociationPanel.tsx (新)
│
└─ hooks/
   ├─ useCredentials.ts (修改)
   ├─ useProjects.ts (新)
   ├─ useRelations.ts (新)
   └─ useImports.ts (新)
```

---

## ✅ 迁移检查清单

### Pre-Migration
- [ ] 完整备份数据库
- [ ] 生成迁移脚本
- [ ] 创建测试数据集
- [ ] 审查所有现有查询

### Migration
- [ ] 创建新表
- [ ] 执行数据迁移  
- [ ] 验证数据完整性
- [ ] 验证所有索引
- [ ] 验证外键约束

### Post-Migration
- [ ] 从 vault_items 移除 project_id
- [ ] 运行所有查询测试
- [ ] 性能基准测试
- [ ] 备份迁移后的数据库

### Code Update
- [ ] 更新所有 SQL 查询
- [ ] 更新所有 Rust 代码
- [ ] 更新所有 React 代码
- [ ] 更新类型定义
- [ ] 运行单元测试
- [ ] 运行集成测试
- [ ] 手动 UI 测试

---

## 🎯 新架构的价值

### 立即收益

✅ **更灵活的凭证管理**
- 可以存储与项目无关的通用凭证
- 支持跨项目凭证共享
- 用户不需要创建虚拟项目

✅ **完整的导入历史管理**
- 可追踪导入来源和状态
- 支持冲突分析和处理
- 可查询导入统计

✅ **独立的API KEY管理**
- 与凭证分离
- 支持过期管理和轮转
- 精细的权限控制

### 未来可能性

🔮 **团队协作**
- 项目级别的权限控制
- 审计日志记录
- 共享和协作流程

🔮 **高级导入**
- 支持多种源 (Bitwarden, 1Password 等)
- 智能重复检测
- 批量处理

🔮 **合规和安全**
- API KEY 轮转计划
- 访问审计日志
- 数据分类和标记

---

## 🔐 安全性考虑

### 现有措施保持不变

✅ 所有凭证仍然加密存储  
✅ 主密码保护不变  
✅ 智能复制功能保持  
✅ 自动锁定保持  

### 新增安全措施

✅ 关联关系无需加密 (仅是元数据)  
✅ 导入历史可清除 (不影响已导入凭证)  
✅ API KEY 有独立的过期机制  
✅ 支持审计日志 (可选实现)  

---

## 📋 决策总结

**推荐**: ✅ 采用新架构

**理由**:
1. 解决现有痛点 (凭证必须关联项目)
2. 仅增加 ~5 小时工作这
3. 获得 5+ 倍的灵活性
4. 为未来扩展奠定基础
5. 用户体验明显改善

**成本**: +5 小时开发时间

**收益**: 
- 架构优雅性 ⭐⭐⭐⭐⭐ (从 ⭐⭐ 提升)
- 代码可维护性 ⭐⭐⭐⭐⭐ (从 ⭐⭐⭐ 提升)
- 功能灵活性 ⭐⭐⭐⭐⭐ (从 ⭐⭐⭐ 提升)
- 未来扩展性 ⭐⭐⭐⭐⭐ (从 ⭐⭐⭐ 提升)

**ROI**: 4:1 (投入 5 小时，获得长期的 4 倍回报)

---

## 🚀 后续

选择此新架构后，下一步:

1. **更新实现计划** 
   - 添加 Phase 0: 架构重设
   - 调整其他 Phase 的工作量

2. **创建数据库迁移脚本**
   - 开发迁移脚本
   - 测试往返迁移

3. **启动实现**
   - 从 Phase 0 开始
   - 按阶段交付

---

**版本**: 2.0 (新架构)  
**更新日期**: 2026-02-15  
**审核状态**: 等待确认
