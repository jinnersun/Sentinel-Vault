# 🏗️ DevVault 架构重设计 V2 - 独立信息模型

**状态**: 新设计方案  
**基于**: 用户反馈的独立性需求  
**关键改进**: 项目、凭证、Chrome密码完全解耦  

---

## 🎯 核心思想转变

### ❌ 旧架构问题

```
vault_items 表
├─ id, type, title, ...
├─ project_id (强制关联)  ❌ 问题
└─ ...
```

**问题**:
- API KEY 必须关联到某个项目
- 无法存储"通用"凭证
- 项目删除后凭证处理复杂
- 凭证无法跨项目共享

### ✅ 新架构优势

```
vault_items (独立)        projects (独立)
├─ id, type, title       ├─ id, name, color, ...
├─ credentials           └─ ...
└─ ...
       ↓ N:N 关联 ↓
credential_project_relations
├─ credential_id, project_id
└─ (可选关联)
```

**优势**:
✅ 完全解耦，灵活关联  
✅ 支持跨项目凭证共享  
✅ 无需创建"虚拟项目"  
✅ 凭证可独立存在  
✅ 易于扩展（Chrome密码、导入等）  

---

## 💾 新数据库设计

### 1️⃣ 核心表：凭证表 (vault_items)

```sql
CREATE TABLE vault_items (
    -- 基础
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,  -- password|server|database|service
    title VARCHAR(255) NOT NULL,
    
    -- 凭证数据
    username VARCHAR(255),
    secret_encrypted TEXT NOT NULL,  -- 密码/密钥（加密）
    secondary_password TEXT,          -- 备用凭证（加密）
    key_material TEXT,                -- SSH密钥等
    
    -- 网络信息
    host VARCHAR(255),                -- IP/域名
    port INTEGER,
    protocol VARCHAR(50),             -- ssh|https|mysql|redis等
    url VARCHAR(2048),                -- 网站地址（密码类型）
    
    -- 分类和标签
    category VARCHAR(100),            -- 通用标签
    tags TEXT,                        -- JSON: ["tag1", "tag2"]
    color VARCHAR(20),                -- 颜色标记
    
    -- 环境信息
    environment VARCHAR(50),          -- dev|test|prod
    
    -- 运维信息
    notes TEXT,                       -- 详细说明
    alert_contact VARCHAR(255),       -- 紧急联系方式
    
    -- 元数据（类型特定）
    metadata JSON,                    -- 云服务商、DB类型等
    
    -- 时间戳
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_accessed BIGINT,
    
    -- 安全
    is_favourite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- 审计
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    INDEX idx_type (type),
    INDEX idx_category (category),
    INDEX idx_environment (environment),
    INDEX idx_host (host),
    INDEX idx_created_at (created_at),
    INDEX idx_archived (is_archived)
);
```

**关键点**:
- ✅ 无 project_id 字段（完全独立）
- ✅ 支持所有凭证类型
- ✅ 灵活的分类和标签系统
- ✅ 丰富的元数据

---

### 2️⃣ 项目表 (projects)

```sql
CREATE TABLE projects (
    -- 基础
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- 外观
    color VARCHAR(20),
    icon_emoji VARCHAR(10),
    
    -- 组织
    parent_project_id VARCHAR(255),   -- 支持项目层级
    
    -- 访问控制
    owner_id VARCHAR(255) NOT NULL,
    team_members TEXT,                -- JSON: ["user1", "user2"]
    
    -- 时间戳
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    
    -- 标记
    is_archived BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (parent_project_id) REFERENCES projects(id),
    CONSTRAINT check_hierarchy CHECK (parent_project_id != id),
    
    INDEX idx_owner (owner_id),
    INDEX idx_archived (is_archived)
);
```

**关键点**:
- ✅ 完全独立，不依赖凭证
- ✅ 支持项目层级
- ✅ 项目可以存在而没有凭证
- ✅ 支持多用户/团队

---

### 3️⃣ 关联表：凭证到项目 (credential_project_relations)

```sql
CREATE TABLE credential_project_relations (
    -- 主键
    id VARCHAR(255) PRIMARY KEY,
    
    -- 关联
    credential_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    
    -- 关联质量
    relationship_type VARCHAR(50) DEFAULT 'associated',  
    -- associated: 普通关联
    -- primary: 主项目
    -- shared: 跨项目共享
    
    -- 时间戳
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255),
    
    -- 唯一约束
    UNIQUE KEY unique_relation (credential_id, project_id),
    
    FOREIGN KEY (credential_id) REFERENCES vault_items(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_credential (credential_id),
    INDEX idx_project (project_id)
);
```

**关键点**:
- ✅ N:N 多对多关系
- ✅ 支持关系类型标记
- ✅ 删除凭证/项目时的级联操作
- ✅ 灵活的关联管理

---

### 4️⃣ Chrome导入历史 (chrome_imported_passwords)

```sql
CREATE TABLE chrome_imported_passwords (
    -- 基础
    id VARCHAR(255) PRIMARY KEY,
    
    -- 导入信息
    import_batch_id VARCHAR(255),     -- 同一批导入
    import_timestamp BIGINT NOT NULL,
    import_source VARCHAR(100),       -- chrome|firefox|safari
    
    -- Chrome原始数据
    origin VARCHAR(2048),             -- 网站
    username_value VARCHAR(255),
    password_value TEXT ENCRYPTED,    -- 加密存储
    signon_realm VARCHAR(1024),
    
    -- 处理状态
    status VARCHAR(50),               -- pending|imported|skipped|failed
    vault_item_id VARCHAR(255),       -- 关联到的vault_item（如果已导入）
    conflict_reason TEXT,             -- 冲突原因
    
    -- 日志
    created_at BIGINT NOT NULL,
    imported_at BIGINT,
    
    FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_batch (import_batch_id),
    INDEX idx_vault_item (vault_item_id)
);
```

**关键点**:
- ✅ 独立的导入历史表
- ✅ 存储导入批次信息
- ✅ 支持冲突跟踪
- ✅ 可选关联到vault_item

---

### 5️⃣ 可选：API KEY 专用表 (api_keys_registry)

```sql
CREATE TABLE api_keys_registry (
    -- 基础
    id VARCHAR(255) PRIMARY KEY,
    
    -- API信息
    name VARCHAR(255) NOT NULL,
    service_name VARCHAR(100),        -- Aliyun|Tencent|AWS|GitHub等
    api_key_encrypted TEXT NOT NULL,  -- 加密
    api_secret_encrypted TEXT,        -- 加密
    
    -- 配置
    endpoint VARCHAR(1024),           -- API端点
    region VARCHAR(100),
    environment VARCHAR(50),          -- dev|test|prod
    
    -- 使用范围
    scope TEXT,                       -- JSON: ["permission1", "permission2"]
    
    -- 安全
    is_active BOOLEAN DEFAULT TRUE,
    last_used BIGINT,
    rotation_needed BOOLEAN DEFAULT FALSE,
    expiry_date BIGINT,
    
    -- 关联
    owner_id VARCHAR(255),
    
    -- 时间戳
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    
    -- 审计
    created_by VARCHAR(255),
    
    INDEX idx_service (service_name),
    INDEX idx_environment (environment),
    INDEX idx_active (is_active)
);
```

**为什么独立表**:
- API KEY 通常更敏感，需要特殊处理
- 可能会被多个项目/流程使用
- 有独特的生命周期（过期、轮转等）
- 支持更复杂的权限管理

---

## 🏗️ 数据关系图

```
┌─────────────────────┐
│  vault_items        │
│  (所有凭证)         │
├─────────────────────┤
│ id (PK)             │
│ type                │
│ title, credentials  │
│ ...                 │
│ (无project_id)      │
└──────────┬──────────┘
           │
           │ N:N
           │ 通过
           │
           ▼
┌──────────────────────────────────┐
│ credential_project_relations     │
│ (N:N关联表)                       │
├──────────────────────────────────┤
│ credential_id (FK)               │
│ project_id (FK)                  │
│ relationship_type                │
└──────────────────────────────────┘
           △
           │
           │ N:N
           │ 通过
           │
┌──────────┴──────────┐
│  projects           │
│  (项目组织)         │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ description         │
│ color, icon_emoji   │
│ owner_id            │
│ (完全独立)          │
└─────────────────────┘
```

---

## 📊 查询示例

### 查询项目下的所有凭证

```sql
SELECT v.* 
FROM vault_items v
JOIN credential_project_relations r ON v.id = r.credential_id
WHERE r.project_id = ?
AND v.is_archived = FALSE
ORDER BY v.created_at DESC;
```

### 查询未关联任何项目的凭证（独立凭证）

```sql
SELECT v.* 
FROM vault_items v
LEFT JOIN credential_project_relations r ON v.id = r.credential_id
WHERE r.credential_id IS NULL
AND v.is_archived = FALSE;
```

### 查询一个凭证关联的所有项目

```sql
SELECT p.* 
FROM projects p
JOIN credential_project_relations r ON p.id = r.project_id
WHERE r.credential_id = ?
AND p.is_archived = FALSE;
```

### 查询跨项目共享的凭证

```sql
SELECT r.credential_id, COUNT(*) as project_count, v.title
FROM credential_project_relations r
JOIN vault_items v ON r.credential_id = v.id
GROUP BY r.credential_id
HAVING project_count > 1
ORDER BY project_count DESC;
```

### 查询项目下的特定类型凭证

```sql
SELECT v.* 
FROM vault_items v
JOIN credential_project_relations r ON v.id = r.credential_id
WHERE r.project_id = ? 
AND v.type = 'server'
AND v.environment = 'prod'
ORDER BY v.title;
```

---

## 🎨 UI 架构重新设计

### 新的导航结构

```
DevVault
├─ 📚 凭证库 (Vault)
│  ├─ 📝 所有凭证
│  │  ├─ 🔑 密码 (50个)
│  │  ├─ 🖥️ 服务器 (20个)
│  │  ├─ 🗄️ 数据库 (15个)
│  │  └─ 🔗 服务 (5个)
│  │
│  ├─ 📌 未归档凭证 (90个)
│  │
│  └─ 📂 按项目浏览
│     ├─ 🚀 项目 A (25个凭证)
│     ├─ 💼 项目 B (18个凭证)
│     └─ 🎯 项目 C (12个凭证)
│
├─ 🏢 项目管理 (Projects)
│  ├─ 创建新项目
│  ├─ 项目 A
│  │  ├─ 相关凭证 (25个)
│  │  ├─ 团队成员
│  │  └─ 设置
│  ├─ 项目 B
│  └─ 项目 C
│
├─ 🔗 API KEY 管理 (New)
│  ├─ Aliyun Keys (3个)
│  ├─ Tencent Keys (2个)
│  ├─ AWS Keys (5个)
│  └─ GitHub Token (1个)
│
└─ 📥 导入和同步 (Import)
   ├─ Chrome 导入
   ├─ 导入历史
   └─ 冲突处理
```

### 凭证详情面板改进

```
┌──────────────────────────────────┐
│ 凭证标题 (Project A, B 共享)     │
├──────────────────────────────────┤
│ 凭证详情                          │
│ - 类型: 服务器                    │
│ - 主机: 1.2.3.4                  │
│ - 用户名: admin                  │
│ - 密码: ****                     │
│                                  │
│ 所属项目:                        │
│ ✓ 项目 A (主要)                 │
│ ✓ 项目 B (共享)                 │
│ + 添加到更多项目                │
│                                  │
│ 说明:                            │
│ 生产环境主服务器                 │
│ 由张三维护                       │
│                                  │
│ [编辑] [删除] [更多选项]         │
└──────────────────────────────────┘
```

---

## 🔄 后端 API 重设计

### Rust 数据结构更新

```rust
// 凭证 (完全独立)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub r#type: CredentialType,
    pub title: String,
    pub username: Option<String>,
    pub secret_encrypted: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub category: String,
    pub environment: Option<String>,
    pub notes: String,
    pub tags: Vec<String>,
    pub metadata: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
    // 无 project_id
}

// 项目 (完全独立)
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
}

// 凭证-项目关联
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialProjectRelation {
    pub id: String,
    pub credential_id: String,
    pub project_id: String,
    pub relationship_type: RelationType, // primary, associated, shared
    pub created_at: i64,
    pub created_by: String,
}

// Chrome导入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromeImportRecord {
    pub id: String,
    pub import_batch_id: String,
    pub origin: String,
    pub username: String,
    pub status: ImportStatus,
    pub vault_item_id: Option<String>,
    pub conflict_reason: Option<String>,
    pub created_at: i64,
}
```

### Tauri 命令重设计

```rust
// ========== 凭证管理 ==========

#[command]
pub async fn create_credential(
    data: Credential,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    // 创建凭证（完全独立，无project_id）
    let db = &state.db;
    db.create_credential(&data)
        .map_err(|e| format!("创建失败: {}", e))
}

#[command]
pub async fn get_all_credentials(
    filter: Option<CredentialFilter>, // type, environment等
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Credential>, String> {
    // 获取所有凭证
    let db = &state.db;
    db.get_credentials_filtered(filter)
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn get_unassociated_credentials(
    // 获取未关联任何项目的凭证
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
    let db = &state.db;
    db.create_project(&project)
        .map_err(|e| format!("创建失败: {}", e))
}

#[command]
pub async fn get_all_projects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    let db = &state.db;
    db.get_all_projects()
        .map_err(|e| format!("查询失败: {}", e))
}

// ========== 关联管理 ==========

#[command]
pub async fn associate_credential_to_project(
    credential_id: String,
    project_id: String,
    relationship_type: RelationType,
    state: tauri::State<'_, AppState>,
) -> Result<CredentialProjectRelation, String> {
    let db = &state.db;
    let relation = CredentialProjectRelation {
        id: nanoid::nanoid!(),
        credential_id,
        project_id,
        relationship_type,
        created_at: current_timestamp(),
        created_by: "system".to_string(),
    };
    
    db.create_relation(&relation)
        .map_err(|e| format!("关联失败: {}", e))
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

#[command]
pub async fn remove_credential_from_project(
    credential_id: String,
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.delete_relation(&credential_id, &project_id)
        .map_err(|e| format!("取消关联失败: {}", e))
}

// ========== Chrome导入 ==========

#[command]
pub async fn import_chrome_passwords_batch(
    records: Vec<ChromeImportRecord>,
    state: tauri::State<'_, AppState>,
) -> Result<ImportSummary, String> {
    let db = &state.db;
    
    let mut imported = 0;
    let mut skipped = 0;
    let mut failed = 0;
    
    for record in records {
        match db.process_chrome_import(&record) {
            Ok(Some(credential_id)) => {
                imported += 1;
            },
            Ok(None) => {
                skipped += 1;
            },
            Err(_) => {
                failed += 1;
            }
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

---

## 🚀 迁移策略

### 从旧架构迁移到新架构

```sql
-- Step 1: 创建新表
CREATE TABLE projects (...);
CREATE TABLE credential_project_relations (...);
CREATE TABLE chrome_imported_passwords (...);

-- Step 2: 数据迁移
-- 为现有凭证创建对应的项目（可选）
INSERT INTO projects (id, name, owner_id, created_at)
SELECT DISTINCT project_id, project_id, 'system', NOW()
FROM vault_items
WHERE project_id IS NOT NULL;

-- 创建关联关系
INSERT INTO credential_project_relations 
  (id, credential_id, project_id, relationship_type, created_at)
SELECT 
  nanoid(), id, project_id, 'primary', created_at
FROM vault_items
WHERE project_id IS NOT NULL;

-- Step 3: 移除旧的project_id（需要验证数据完整性）
ALTER TABLE vault_items DROP COLUMN project_id;

-- Step 4: 验证
SELECT COUNT(*) as total_relations
FROM credential_project_relations;

SELECT COUNT(*) as orphan_credentials
FROM vault_items v
LEFT JOIN credential_project_relations r ON v.id = r.credential_id
WHERE r.credential_id IS NULL;
```

---

## 📋 核心优势总结

| 特性 | 旧架构 | 新架构 |
|------|--------|--------|
| 凭证独立存在 | ❌ 必须关联项目 | ✅ 可完全独立 |
| 跨项目共享 | ❌ 需要复制 | ✅ 原生支持 |
| 凭证-项目关系 | 一对一 | ✅ 多对多 (N:N) |
| 项目存在无凭证 | ❌ 可能为空 | ✅ 支持 |
| 关系类型 | ❌ 无 | ✅ primary/associated/shared |
| Chrome导入管理 | ❌ 混在一起 | ✅ 独立表管理 |
| API KEY 管理 | ❌ 和凭证混合 | ✅ 独立表(可选) |
| 扩展性 | ⭐ | ⭐⭐⭐⭐⭐ |

---

## 🔄 前端数据流重设计

### AppContext 新结构

```tsx
interface AppContextType {
  // 凭证库（完全独立）
  credentials: Credential[];
  selectedCredential: Credential | null;
  
  // 项目库（完全独立）
  projects: Project[];
  selectedProject: Project | null;
  
  // 关联关系
  credentialProjectRelations: CredentialProjectRelation[];
  
  // 视图状态
  view: 'vault' | 'projects' | 'imports' | 'api-keys';
  credentialFilter: CredentialFilter;
  
  // Actions
  actions: {
    // 凭证操作
    createCredential(data: Credential): Promise<void>;
    updateCredential(id: string, data: Partial<Credential>): Promise<void>;
    deleteCredential(id: string): Promise<void>;
    getCredentials(filter?: CredentialFilter): Promise<Credential[]>;
    
    // 项目操作
    createProject(data: Project): Promise<void>;
    updateProject(id: string, data: Partial<Project>): Promise<void>;
    deleteProject(id: string): Promise<void>;
    getProjects(): Promise<Project[]>;
    
    // 关联操作
    associateCredentialToProject(credentialId: string, projectId: string): Promise<void>;
    disassociateCredentialFromProject(credentialId: string, projectId: string): Promise<void>;
    getProjectCredentials(projectId: string): Promise<Credential[]>;
    getCredentialProjects(credentialId: string): Promise<Project[]>;
  };
}
```

### UI 组件新层次

```
App
├─ MainLayout (新导航)
│  ├─ Sidebar (三大区域)
│  │  ├─ VaultSection
│  │  ├─ ProjectsSection
│  │  └─ MoreSection
│  │
│  └─ MainContent (根据选择展示不同视图)
│     ├─ VaultView (显示所有凭证或未关联凭证)
│     ├─ ProjectView (显示项目及其凭证)
│     ├─ ProjectsManagementView (项目管理)
│     ├─ ChromeImportView (导入历史)
│     └─ APIKeysView (API KEY管理)
```

---

## ✅ 实现检查清单

### 数据库阶段
- [ ] 创建 projects 表
- [ ] 创建 credential_project_relations 表
- [ ] 创建 chrome_imported_passwords 表
- [ ] 从 vault_items 中移除 project_id（迁移后）
- [ ] 验证所有索引和约束

### 后端实现
- [ ] 更新所有 CRUD 命令
- [ ] 实现新的查询接口
- [ ] 实现关联管理 API
- [ ] 实现导入历史API
- [ ] 错误处理和事务管理

### 前端实现
- [ ] 更新 AppContext 结构
- [ ] 重新设计导航栏
- [ ] 创建项目管理视图
- [ ] 创建导入历史视图
- [ ] 更新凭证详情面板

### 测试
- [ ] 数据库完整性测试
- [ ] API 端点功能测试
- [ ] UI 交互测试
- [ ] 迁移数据验证

---

## 🎯 为什么这个架构更优

**灵活性** ✅
- 凭证可独立存在，无需强制关联
- 支持无限灵活的关联方式

**可维护性** ✅
- 清晰的数据模型和关系
- 易于理解和扩展

**性能** ✅
- 优化的查询性能
- 清晰的索引策略

**用户体验** ✅
- 用户不需要创建虚拟项目
- 更加直观和自然

**未来扩展** ✅
- 易于添加团队、权限等功能
- 支持API KEY、导入历史等独立管理

---

**推荐**: 采用此新架构，将大大提升系统的灵活性和未来的可扩展性。

