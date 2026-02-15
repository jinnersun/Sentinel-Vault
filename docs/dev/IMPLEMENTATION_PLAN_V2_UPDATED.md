# 🚀 服务器&数据库凭证管理 - 更新实现计划 V2

**基于**: 新的架构重设计 (独立信息模型)  
**版本**: 2.0  
**更新日期**: 2026-02-15  

---

## 📋 核心变更

### 架构变更摘要

| 方面 | V1 (旧) | V2 (新) |
|------|---------|---------|
| 数据模型 | 凭证依赖项目 | 凭证和项目独立 |
| 关联方式 | 一对一 (vault_items.project_id) | N:N (relations表) |
| 凭证关系 | 必须属于项目 | 可选关联 |
| 跨项目支持 | ❌ 需要复制 | ✅ 原生支持 |
| 导入管理 | 混合在凭证中 | 独立表管理 |
| 工作量 | 40-50 小时 | 45-55 小时 |

---

## 🏗️ 新的 5+1 阶段计划

### Phase 0: 基础设施 - 架构重设 (1 天) ⭐ 新增

**目标**: 建立新的数据模型和表结构

#### 数据库设计

```sql
-- 1. 创建项目表
CREATE TABLE projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(20),
    icon_emoji VARCHAR(10),
    parent_project_id VARCHAR(255),
    owner_id VARCHAR(255) NOT NULL,
    team_members TEXT,  -- JSON
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (parent_project_id) REFERENCES projects(id),
    CONSTRAINT check_hierarchy CHECK (parent_project_id != id),
    INDEX idx_owner (owner_id),
    INDEX idx_archived (is_archived)
);

-- 2. 创建关联表
CREATE TABLE credential_project_relations (
    id VARCHAR(255) PRIMARY KEY,
    credential_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'associated',
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255),
    
    UNIQUE KEY unique_relation (credential_id, project_id),
    FOREIGN KEY (credential_id) REFERENCES vault_items(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_credential (credential_id),
    INDEX idx_project (project_id)
);

-- 3. 创建Chrome导入表
CREATE TABLE chrome_imported_passwords (
    id VARCHAR(255) PRIMARY KEY,
    import_batch_id VARCHAR(255),
    import_timestamp BIGINT NOT NULL,
    import_source VARCHAR(100),  -- chrome|firefox|safari
    origin VARCHAR(2048),
    username_value VARCHAR(255),
    password_value TEXT ENCRYPTED,
    signon_realm VARCHAR(1024),
    status VARCHAR(50),  -- pending|imported|skipped|failed
    vault_item_id VARCHAR(255),
    conflict_reason TEXT,
    created_at BIGINT NOT NULL,
    imported_at BIGINT,
    
    FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_batch (import_batch_id),
    INDEX idx_vault_item (vault_item_id)
);

-- 4. 修改vault_items表 (可选)
-- 从vault_items中删除project_id（如果存在）
-- ALTER TABLE vault_items DROP COLUMN project_id;

-- 添加新字段
ALTER TABLE vault_items ADD COLUMN (
    host VARCHAR(255) DEFAULT NULL,
    port INTEGER DEFAULT NULL,
    protocol VARCHAR(50) DEFAULT NULL,
    environment VARCHAR(50) DEFAULT NULL,
    secondary_password VARCHAR(512) DEFAULT NULL,
    key_material LONGTEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    alert_contact VARCHAR(255) DEFAULT NULL,
    
    INDEX idx_type (type),
    INDEX idx_environment (environment),
    INDEX idx_host (host)
);
```

#### 数据迁移脚本

```sql
-- Step 1: 为现有项目创建项目记录（从现有的project_id推断）
INSERT IGNORE INTO projects (id, name, owner_id, created_at, updated_at, is_archived)
SELECT 
    project_id,
    project_id as name,
    'system' as owner_id,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at,
    FALSE
FROM vault_items
WHERE project_id IS NOT NULL
GROUP BY project_id;

-- Step 2: 创建关联关系
INSERT INTO credential_project_relations 
  (id, credential_id, project_id, relationship_type, created_at, created_by)
SELECT 
    CONCAT(id, '_', project_id) as id,
    id as credential_id,
    project_id as project_id,
    'primary' as relationship_type,
    created_at,
    'migration' as created_by
FROM vault_items
WHERE project_id IS NOT NULL;

-- Step 3: 清理（可选，谨慎执行）
-- ALTER TABLE vault_items DROP COLUMN project_id;

-- Step 4: 验证
SELECT 
    (SELECT COUNT(*) FROM projects) as projects_count,
    (SELECT COUNT(*) FROM credential_project_relations) as relations_count,
    (SELECT COUNT(*) FROM vault_items WHERE id IN (SELECT credential_id FROM credential_project_relations)) as associated_credentials,
    (SELECT COUNT(*) FROM vault_items) as total_credentials;
```

#### 输出物

✅ 4 个新表创建  
✅ vault_items 表扩展 (7 个新字段)  
✅ 数据迁移脚本  
✅ 验证查询集  

**工作量**: ~4 小时
- 数据库设计: 1 小时
- SQL 脚本编写: 1.5 小时
- 迁移测试和验证: 1.5 小时

---

### Phase 1: 后端 API - 核心命令实现 (2-3 天)

**目标**: 实现所有 CRUD 和关联管理命令

#### Rust 结构体 (database.rs / models.rs)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CredentialType {
    Password,
    Server,
    Database,
    Service,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub r#type: CredentialType,
    pub title: String,
    pub username: Option<String>,
    pub secret_encrypted: String,
    pub secondary_password: Option<String>,
    pub key_material: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub protocol: Option<String>,
    pub url: Option<String>,
    pub category: String,
    pub tags: Vec<String>,
    pub color: String,
    pub environment: Option<String>,
    pub notes: String,
    pub metadata: Option<Value>,
    pub alert_contact: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_accessed: Option<i64>,
    pub is_favourite: bool,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub icon_emoji: Option<String>,
    pub owner_id: String,
    pub team_members: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialProjectRelation {
    pub id: String,
    pub credential_id: String,
    pub project_id: String,
    pub relationship_type: String,  // primary, associated, shared
    pub created_at: i64,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromeImportRecord {
    pub id: String,
    pub import_batch_id: String,
    pub origin: String,
    pub username: String,
    pub password_encrypted: String,
    pub status: String,
    pub vault_item_id: Option<String>,
    pub conflict_reason: Option<String>,
    pub created_at: i64,
}
```

#### Tauri 命令 (commands.rs)

```rust
// ========== 凭证管理 ==========

#[command]
pub async fn create_credential(
    data: Credential,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    let db = &state.db;
    db.create_credential(&data)
        .map_err(|e| format!("创建失败: {}", e))
}

#[command]
pub async fn update_credential(
    id: String,
    data: Credential,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    let db = &state.db;
    db.update_credential(&id, &data)
        .map_err(|e| format!("更新失败: {}", e))
}

#[command]
pub async fn delete_credential(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.delete_credential(&id)
        .map_err(|e| format!("删除失败: {}", e))
}

#[command]
pub async fn get_all_credentials(
    filter: Option<CredentialFilter>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Credential>, String> {
    let db = &state.db;
    db.get_credentials_filtered(filter)
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn get_credential(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    let db = &state.db;
    db.get_credential(&id)
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn get_unassociated_credentials(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Credential>, String> {
    let db = &state.db;
    db.get_unassociated_credentials()
        .map_err(|e| format!("查询失败: {}", e))
}

// ========== 项目管理 ==========

#[command]
pub async fn create_project(
    project: Project,
    state: tauri::State<'_, AppState>,
) -> Result<Project, String> {
    if project.name.is_empty() {
        return Err("项目名称不能为空".to_string());
    }
    
    let db = &state.db;
    db.create_project(&project)
        .map_err(|e| format!("创建失败: {}", e))
}

#[command]
pub async fn update_project(
    id: String,
    project: Project,
    state: tauri::State<'_, AppState>,
) -> Result<Project, String> {
    let db = &state.db;
    db.update_project(&id, &project)
        .map_err(|e| format!("更新失败: {}", e))
}

#[command]
pub async fn delete_project(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.delete_project(&id)
        .map_err(|e| format!("删除失败: {}", e))
}

#[command]
pub async fn get_all_projects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    let db = &state.db;
    db.get_all_projects()
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn get_project(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Project, String> {
    let db = &state.db;
    db.get_project(&id)
        .map_err(|e| format!("查询失败: {}", e))
}

// ========== 关联管理 ==========

#[command]
pub async fn associate_credential_to_project(
    credential_id: String,
    project_id: String,
    relationship_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<CredentialProjectRelation, String> {
    let db = &state.db;
    let relation = CredentialProjectRelation {
        id: nanoid::nanoid!(),
        credential_id,
        project_id,
        relationship_type: relationship_type.unwrap_or("associated".to_string()),
        created_at: current_timestamp(),
        created_by: "system".to_string(),
    };
    
    db.create_relation(&relation)
        .map_err(|e| format!("关联失败: {}", e))
}

#[command]
pub async fn disassociate_credential_from_project(
    credential_id: String,
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.delete_relation(&credential_id, &project_id)
        .map_err(|e| format!("取消关联失败: {}", e))
}

#[command]
pub async fn get_project_credentials(
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Credential>, String> {
    let db = &state.db;
    db.get_credentials_by_project(&project_id)
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn get_credential_projects(
    credential_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    let db = &state.db;
    db.get_projects_by_credential(&credential_id)
        .map_err(|e| format!("查询失败: {}", e))
}

// ========== Chrome导入 ==========

#[command]
pub async fn get_chrome_import_history(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ChromeImportRecord>, String> {
    let db = &state.db;
    db.get_chrome_import_history()
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn process_chrome_import_batch(
    records: Vec<ChromeImportRecord>,
    state: tauri::State<'_, AppState>,
) -> Result<ImportSummary, String> {
    let db = &state.db;
    let mut imported = 0;
    let mut skipped = 0;
    let mut failed = 0;
    
    for record in records {
        match db.process_chrome_import(&record) {
            Ok(Some(_)) => imported += 1,
            Ok(None) => skipped += 1,
            Err(_) => failed += 1,
        }
    }
    
    Ok(ImportSummary {
        total: records.len(),
        imported,
        skipped,
        failed,
    })
}

#[command]
pub async fn link_imported_password_to_credential(
    import_record_id: String,
    credential_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.link_import_to_credential(&import_record_id, &credential_id)
        .map_err(|e| format!("链接失败: {}", e))
}
```

#### 输出物

✅ 完整的 Rust 数据结构 (4 个)  
✅ 核心 Tauri 命令 (15+ 个)  
✅ 业务逻辑实现  
✅ 单元测试  

**工作量**: ~8 小时
- 数据结构设计: 1 小时
- 命令实现: 5 小时
- 单元测试: 2 小时

---

### Phase 2: 前端 - UI 框架和导航 (2-3 天)

**目标**: 建立新的 UI 结构和导航体系

#### AppContext 重设计

```tsx
// contexts/AppContext.tsx
interface CredentialFilter {
  type?: CredentialType;
  environment?: string;
  archived?: boolean;
  search?: string;
}

interface AppContextType {
  // 数据
  credentials: Credential[];
  projects: Project[];
  relations: CredentialProjectRelation[];
  chromeImports: ChromeImportRecord[];
  
  // UI状态
  activeView: 'vault' | 'projects' | 'imports' | 'api-keys';
  selectedCredential: Credential | null;
  selectedProject: Project | null;
  credentialFilter: CredentialFilter;
  
  // Actions
  actions: {
    // 凭证
    createCredential(data: Credential): Promise<void>;
    updateCredential(id: string, data: Partial<Credential>): Promise<void>;
    deleteCredential(id: string): Promise<void>;
    
    // 项目
    createProject(data: Project): Promise<void>;
    updateProject(id: string, data: Partial<Project>): Promise<void>;
    deleteProject(id: string): Promise<void>;
    
    // 关联
    associateCredentialToProject(credId: string, projId: string): Promise<void>;
    disassociateCredentialFromProject(credId: string, projId: string): Promise<void>;
    
    // 导入
    importChromePasswords(): Promise<void>;
    confirmChromeImport(importId: string): Promise<void>;
  };
}
```

#### 新的导航组件

```tsx
// components/MainLayout.tsx
export default function MainLayout() {
  const { activeView, setActiveView } = useContext(AppContext);
  
  return (
    <div className="flex h-screen">
      {/* Sidebar - 新的多区域结构 */}
      <Sidebar>
        <div className="p-4 space-y-6">
          {/* 1. 凭证库区域 */}
          <VaultSection />
          
          {/* 2. 项目区域 */}
          <ProjectsSection />
          
          {/* 3. 其他区域 */}
          <MoreSection />
        </div>
      </Sidebar>
      
      {/* Main Content - 根据view切换 */}
      <MainContent>
        {activeView === 'vault' && <VaultView />}
        {activeView === 'projects' && <ProjectsView />}
        {activeView === 'imports' && <ImportsView />}
        {activeView === 'api-keys' && <APIKeysView />}
      </MainContent>
    </div>
  );
}
```

#### 新的视图组件

```
src/components/views/
├─ VaultView.tsx
│  ├─ 显示所有凭证
│  ├─ 显示未关联凭证
│  └─ 搜索和过滤
│
├─ ProjectsView.tsx
│  ├─ 项目列表
│  ├─ 项目详情
│  ├─ 关联凭证列表
│  └─ 项目设置
│
├─ ImportsView.tsx
│  ├─ 导入历史
│  ├─ 冲突处理
│  └─ 导入统计
│
└─ APIKeysView.tsx (可选)
   ├─ API KEY列表
   ├─ 按服务分组
   └─ 密钥管理
```

#### 输出物

✅ 更新的 AppContext  
✅ 重新设计的导航  
✅ 4+ 个新视图组件  
✅ 样式和布局  

**工作量**: ~8 小时
- 架构设计: 1 小时
- Sidebar 改造: 2 小时
- 新视图实现: 4 小时
- 样式调整: 1 小时

---

### Phase 3: 凭证管理 UI - 服务器、数据库、服务 (2-3 天)

**目标**: 实现各类型凭证的完整表单和列表

#### 凭证类型特定组件

```
src/components/credentials/
├─ PasswordCredential.tsx
├─ ServerCredential.tsx (新，2-3 天)
├─ DatabaseCredential.tsx (新，2-3 天)
├─ ServiceCredential.tsx (新，1 天)
└─ modals/
   ├─ CredentialModal.tsx
   ├─ ServerModal.tsx
   ├─ DatabaseModal.tsx
   └─ ServiceModal.tsx
```

**每个凭证类型**:
- 专用 Modal/Form
- 专用 List 组件
- 专用 Details Panel
- 类型特定的字段验证

**工作量**: ~10 小时
- ServerCredential: 3-4 小时
- DatabaseCredential: 2-3 小时
- ServiceCredential: 1-2 小时
- 共享组件优化: 2 小时

---

### Phase 4: 高级功能 (1-2 天)

**目标**: 搜索、过滤、连接测试等

#### 功能列表

- [ ] 高级搜索和过滤
- [ ] 跨项目搜索
- [ ] 标签管理
- [ ] 收藏功能
- [ ] 导出功能 (CSV/JSON)
- [ ] 连接测试 (可选)
  - [ ] SSH 连接测试
  - [ ] MySQL 连接测试
  - [ ] PostgreSQL 连接测试

**工作量**: ~6 小时

---

### Phase 5: 优化和发布 (1-2 天)

**目标**: 性能优化、文档、测试、发布

#### 清单

- [ ] 性能优化（查询、缓存、渲染）
- [ ] 完整测试覆盖
- [ ] 文档编写
- [ ] 用户手册
- [ ] 发布 v0.3.0

**工作量**: ~6 小时

---

## 📊 新版工作量估算

### 后端 (Rust)

| 任务 | 时间 |
|------|------|
| Phase 0: 数据库设计 | 4 小时 |
| Phase 1: API 实现 | 8 小时 |
| 测试和集成 | 3 小时 |
| **后端小计** | **15 小时** |

### 前端 (React)

| 任务 | 时间 |
|------|------|
| Phase 2: UI 框架 | 8 小时 |
| Phase 3: 凭证UI | 10 小时 |
| Phase 4: 高级功能 | 6 小时 |
| **前端小计** | **24 小时** |

### 测试和优化

| 任务 | 时间 |
|------|------|
| 单元测试 | 3 小时 |
| 集成测试 | 3 小时 |
| 性能测试 | 2 小时 |
| Phase 5: 优化 | 6 小时 |
| **测试小计** | **14 小时** |

### 总计: 53 小时

**对比**: 原计划 50 小时 → 新计划 53 小时  
**增加**: ~3 小时 (+6%)  
**原因**: 更完善的架构需要更多设计和测试

---

## ⏱️ 时间表

```
Week 1 (Day 1-5):
  Day 1 (4h): Phase 0 - 数据库架构和迁移
  Day 2-3 (8h): Phase 1 - 后端 API
  Day 4-5 (8h): Phase 2 - 前端框架

Week 2 (Day 6-10):
  Day 1-2 (10h): Phase 3 - 凭证 UI
  Day 3-4 (6h): Phase 4 - 高级功能
  Day 5 (4h): Phase 5 开始

Week 3 (Day 11+):
  Day 1-2 (10h): Phase 5 - 完成
          (3h): 发布准备
```

**全职开发**: 7-8 天  
**兼职开发** (4h/day): 2-3 周  

---

## ✅ 验收标准

### Phase 0
- ✅ 四个新表创建
- ✅ 数据完整迁移
- ✅ 查询验证通过

### Phase 1
- ✅ 所有 CRUD 命令可用
- ✅ 关联管理正常工作
- ✅ 单元测试通过

### Phase 2
- ✅ 新导航可用
- ✅ 四个视图可切换
- ✅ 项目管理基本功能

### Phase 3
- ✅ 所有凭证类型表单可用
- ✅ 详情面板显示类型特定字段
- ✅ CRUD 操作完整

### Phase 4
- ✅ 搜索过滤可用
- ✅ 连接测试（如适用）可用
- ✅ 导出功能可用

### Phase 5
- ✅ 性能指标达到标准
- ✅ 100% 功能测试通过
- ✅ 文档完整
- ✅ v0.3.0 发布

---

## 🎯 后续步骤

1. **确认新架构** ✅ (等待您的确认)
2. **开始 Phase 0** → 数据库设计和迁移
3. **逐阶段交付** → 每个 phase 完成后提交 PR
4. **持续反馈** → 根据测试调整

---

**版本**: 2.0 (Updated for V2 Architecture)  
**创建日期**: 2026-02-15  
**预计完成**: 2026-02-22 (7-8 天) 或 2026-03-01 (2-3周/兼职)
