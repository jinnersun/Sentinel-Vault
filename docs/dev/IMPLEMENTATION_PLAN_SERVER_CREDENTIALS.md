# ⚠️ [已废弃 - V1 实现计划] 服务器&数据库凭证管理

> **本文档已过时，请使用新的 V2 架构实现计划**
> 📌 **请参考**: [`IMPLEMENTATION_PLAN_V2_UPDATED.md`](IMPLEMENTATION_PLAN_V2_UPDATED.md)

---

**原状态**: 详细设计 (V1)  
**基于分析**: FEATURE_ANALYSIS_SERVER_CREDENTIALS.md  
**原建议架构**: 选项 C (混合方案)  

---

## 🎯 设计决策总结

### 选择的架构: 选项 C (扩展 vault_items)

**原因**:
✅ 最小化数据库迁移  
✅ 兼容现有密码管理功能  
✅ 灵活支持多种类型  
✅ UI 代码复用最高  
✅ 查询性能最优  

```
单一 vault_items 表，通过 type 字段区分:
- type = 'password'  (现有)
- type = 'server'    (新)
- type = 'database'  (新)
- type = 'service'   (新)

灵活字段设计:
├─ 通用字段 (所有类型)
│  ├─ title, category, project_id
│  ├─ created_at, updated_at, color
│  └─ notes (详细说明)
├─ 可选字段 (某些类型使用)
│  ├─ host, port, protocol
│  ├─ username, password
│  └─ secondary_password (备用)
└─ 扩展字段 (类型特定)
   └─ metadata (JSON) - 云服务商、环境等
```

---

## 💾 数据库设计

### 修改 vault_items 表结构

```sql
-- 原表 (保持现有)
ALTER TABLE vault_items 
ADD COLUMN (
    -- 类型和分类
    type VARCHAR(50) NOT NULL DEFAULT 'password',     -- password/server/database/service
    environment VARCHAR(50) DEFAULT NULL,             -- dev/test/prod
    
    -- 网络信息 (用于服务器、数据库等)
    host VARCHAR(255) DEFAULT NULL,                   -- IP 或域名
    port INTEGER DEFAULT NULL,                        -- 端口号
    protocol VARCHAR(50) DEFAULT NULL,                -- ssh/https/mysql 等
    
    -- 凭证字段 (扩展)
    secondary_password VARCHAR(512) DEFAULT NULL,     -- 密钥、token 等（加密）
    key_material LONGTEXT DEFAULT NULL,               -- SSH 密钥、证书等
    
    -- 元数据 (JSON)
    metadata JSON DEFAULT NULL,                       -- 类型特定字段
    
    -- 扩展信息
    alert_contact VARCHAR(255) DEFAULT NULL,         -- 紧急联系方式
    
    -- 索引字段
    CONSTRAINT check_type CHECK (type IN ('password', 'server', 'database', 'service')),
    CONSTRAINT check_env CHECK (environment IS NULL OR environment IN ('dev', 'test', 'prod'))
);

-- 创建必要的索引
CREATE INDEX idx_vault_type ON vault_items (type);
CREATE INDEX idx_vault_environment ON vault_items (environment);
CREATE INDEX idx_vault_host ON vault_items (host);
CREATE INDEX idx_vault_project_type ON vault_items (project_id, type);
```

### metadata 字段结构 (JSON)

#### 服务器 metadata
```json
{
    "cloud_provider": "aliyun|tencent|aws|azure|gcp|other",
    "server_type": "ecs|lightweight|physical",
    "region": "cn-beijing",
    "zone": "cn-beijing-a",
    "public_ip": "1.2.3.4",
    "private_ip": "10.0.0.1",
    "os": "Ubuntu 20.04|CentOS 8|Windows Server",
    "cpu_cores": "4",
    "memory_gb": "16",
    "disk_gb": "100",
    "bandwidth_mbps": "10",
    "instance_id": "i-1234567890abcdef0",
    "ssh_key_name": "key-name",
    "security_group": "sg-xxx"
}
```

#### 数据库 metadata
```json
{
    "db_type": "mysql|postgresql|mongodb|redis|sqlserver|oracle",
    "db_version": "8.0.28",
    "database_name": "production_db",
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "replication_role": "master|slave|replica",
    "backup_enabled": true,
    "backup_time": "02:00",
    "recovery_point_objective_hours": 24,
    "pool_config": {
        "min_connections": 5,
        "max_connections": 20,
        "idle_timeout_seconds": 300,
        "query_timeout_seconds": 30
    },
    "ssl_enabled": true,
    "maintenance_window": "Sunday 22:00-23:00"
}
```

#### 通用服务 metadata
```json
{
    "service_type": "redis|rabbitmq|kafka|elasticsearch|prometheus",
    "cluster_name": "cluster-1",
    "use_ssl": true,
    "use_tls": false,
    "auth_token_type": "bearer|basic|custom",
    "monitoring_url": "https://prometheus.example.com",
    "version": "6.0.3",
    "replicas": 3
}
```

---

## 🎨 UI 架构设计

### 总体布局 (Tab + 增强 Sidebar)

```
┌─────────────────────────────────────┐
│        DevVault Header              │
├─ 📋 Credentials │ 📊 Analytics ────┤
│                 │                  │
│  Left Sidebar   │  Main Content    │
│  ┌───────────┐  │  ┌─────────────┐ │
│  │ 🔑 Passw. │  │  │  Password   │ │
│  │ ├─ P1     │  │  │  📋 List   │ │
│  │ ├─ P2     │  │  │             │ │
│  │ └─ Others │  │  │ Details     │ │
│  │           │  │  │ Panel       │ │
│  │ 🖥️ Server  │  │  │             │ │
│  │ ├─ Ali    │  │  │             │ │
│  │ ├─ AWS    │  │  │             │ │
│  │ └─ Tencent│  │  │             │ │
│  │           │  │  │             │ │
│  │ 🗄️ DB     │  │  └─────────────┘ │
│  │ ├─ MySQL  │  │                  │
│  │ ├─ PG     │  │                  │
│  │ └─ Mongo  │  │                  │
│  │           │  │                  │
│  │ 🔗 Service│  │                  │
│  │ ├─ Redis  │  │                  │
│  │ ├─ MQ     │  │                  │
│  │ └─ ELK    │  │                  │
│  └───────────┘  │                  │
│                 │                  │
└─────────────────────────────────────┘
```

---

## 🔄 前端组件结构

### 新增组件

```
src/components/credentials/
├── CredentialsPage.tsx          # 主容器
├── CredentialsSidebar.tsx       # 左侧导航
├── credentials/
│  ├── PasswordCredential.tsx    # 密码凭证（现有改造）
│  ├── ServerCredential.tsx      # 服务器凭证（新）
│  ├── DatabaseCredential.tsx    # 数据库凭证（新）
│  └── ServiceCredential.tsx     # 其他服务凭证（新）
├── dialogs/
│  ├── ServerModal.tsx           # 服务器编辑对话框
│  ├── DatabaseModal.tsx         # 数据库编辑对话框
│  ├── ServiceModal.tsx          # 服务编辑对话框
│  └── CredentialDetailsPanel.tsx # 详情和说明
├── lists/
│  ├── PasswordList.tsx          # 密码列表
│  ├── ServerList.tsx            # 服务器列表
│  ├── DatabaseList.tsx          # 数据库列表
│  └── ServiceList.tsx           # 服务列表
└── utils/
   ├── credentialTypes.ts        # 类型定义
   └── connectionTester.ts       # 连接测试工具
```

### 组件关系图

```
CredentialsPage (v1.0 改造的 MainLayout)
├── CredentialsSidebar
│  └── 处理类型/项目过滤
├── CredentialsView (根据类型切换)
│  ├── PasswordList → CredentialDetailsPanel
│  ├── ServerList → ServerModal
│  ├── DatabaseList → DatabaseModal
│  └── ServiceList → ServiceModal
└── 共享状态
   └── AppContext (扩展以支持新类型)
```

### 数据流

```
AppContext (全局凭证管理)
├── state: {
│  ├── credentials: [] (所有凭证)
│  ├── selectedCredential: {} (当前选中)
│  ├── activeType: 'password'|'server'|'database'|'service'
│  └── activeCategory: string
├── actions: {
│  ├── addCredential(credential)
│  ├── updateCredential(id, data)
│  ├── deleteCredential(id)
│  ├── setActiveType(type)
│  └── testConnection(credential)
└── hooks: {
   ├── useCredentials()
   ├── useServers()
   ├── useDatabases()
   └── useServices()
}
```

---

## 🛠️ 后端实现

### Rust 数据结构更新

**src-tauri/src/types.rs** (新增/修改)

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    pub secret_encrypted: String,      // 主密码/密钥
    pub secondary_password: Option<String>, // 备用凭证（加密）
    pub key_material: Option<String>,   // SSH 密钥等
    pub url: Option<String>,            // 网址或域名
    pub host: Option<String>,           // IP 或主机名
    pub port: Option<u16>,              // 端口
    pub protocol: Option<String>,       // 协议
    pub category: String,
    pub project_id: Option<String>,
    pub color: String,
    pub environment: Option<String>,    // dev/test/prod
    pub metadata: Option<Value>,        // 类型特定字段
    pub notes: String,                  // 说明
    pub alert_contact: Option<String>,  // 紧急联系方式
    pub created_at: i64,
    pub updated_at: i64,
    pub last_accessed: Option<i64>,
}

// 针对不同类型的结构体（用于前端表单）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCredentialForm {
    pub title: String,
    pub cloud_provider: String,
    pub public_ip: String,
    pub private_ip: Option<String>,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub ssh_key: Option<String>,
    pub key_passphrase: Option<String>,
    pub region: String,
    pub os_type: String,
    pub environment: String,
    pub project_id: String,
    pub notes: String,
    pub alert_contact: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseCredentialForm {
    pub title: String,
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database_name: String,
    pub charset: Option<String>,
    pub version: Option<String>,
    pub environment: String,
    pub project_id: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCredentialForm {
    pub title: String,
    pub service_type: String,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub auth_token: Option<String>,
    pub environment: String,
    pub project_id: String,
    pub notes: String,
}
```

### Tauri 命令实现

**src-tauri/src/commands.rs** (新增)

```rust
// ======== 服务器凭证 ========
#[command]
pub async fn create_server_credential(
    form: ServerCredentialForm,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    // 验证输入
    if form.title.is_empty() || form.host.is_empty() || form.username.is_empty() {
        return Err("缺少必要字段".to_string());
    }
    
    let db = &state.db;
    let credential = Credential {
        id: nanoid::nanoid!(),
        r#type: CredentialType::Server,
        title: form.title,
        username: Some(form.username),
        secret_encrypted: encrypt_password(&form.password)?,
        secondary_password: form.ssh_key.as_ref()
            .map(|k| encrypt_password(k))
            .transpose()?,
        key_material: form.key_passphrase.as_ref()
            .map(|k| encrypt_password(k))
            .transpose()?,
        host: Some(form.public_ip),
        port: Some(form.port),
        category: "Server".to_string(),
        project_id: Some(form.project_id),
        environment: Some(form.environment),
        notes: form.notes,
        alert_contact: form.alert_contact,
        metadata: Some(serde_json::json!({
            "cloud_provider": form.cloud_provider,
            "private_ip": form.private_ip,
            "region": "unknown",
            "os": form.os_type,
        })),
        created_at: current_timestamp(),
        updated_at: current_timestamp(),
        ..Default::default()
    };
    
    db.create_credential(&credential)
        .map_err(|e| format!("创建失败: {}", e))?;
    
    Ok(credential)
}

#[command]
pub async fn get_server_credentials(
    project_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Credential>, String> {
    let db = &state.db;
    db.get_credentials_by_type_and_project("server", project_id)
        .map_err(|e| format!("查询失败: {}", e))
}

#[command]
pub async fn update_server_credential(
    id: String,
    form: ServerCredentialForm,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    // 获取现有凭证
    let db = &state.db;
    let mut credential = db.get_credential(&id)
        .map_err(|e| format!("凭证不存在: {}", e))?;
    
    // 更新字段
    credential.title = form.title;
    credential.username = Some(form.username);
    credential.secret_encrypted = encrypt_password(&form.password)?;
    credential.secondary_password = form.ssh_key.as_ref()
        .map(|k| encrypt_password(k))
        .transpose()?;
    credential.host = Some(form.public_ip);
    credential.port = Some(form.port);
    credential.environment = Some(form.environment);
    credential.notes = form.notes;
    credential.alert_contact = form.alert_contact;
    credential.updated_at = current_timestamp();
    
    db.update_credential(&credential)
        .map_err(|e| format!("更新失败: {}", e))?;
    
    Ok(credential)
}

#[command]
pub async fn delete_server_credential(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    db.delete_credential(&id)
        .map_err(|e| format!("删除失败: {}", e))
}

// ======== 数据库凭证 ========
#[command]
pub async fn create_database_credential(
    form: DatabaseCredentialForm,
    state: tauri::State<'_, AppState>,
) -> Result<Credential, String> {
    let db = &state.db;
    let credential = Credential {
        id: nanoid::nanoid!(),
        r#type: CredentialType::Database,
        title: form.title,
        username: Some(form.username),
        secret_encrypted: encrypt_password(&form.password)?,
        host: Some(form.host),
        port: Some(form.port),
        category: "Database".to_string(),
        project_id: Some(form.project_id),
        environment: Some(form.environment),
        notes: form.notes,
        metadata: Some(serde_json::json!({
            "db_type": form.db_type,
            "database_name": form.database_name,
            "charset": form.charset.unwrap_or("utf8mb4".to_string()),
            "version": form.version,
        })),
        created_at: current_timestamp(),
        updated_at: current_timestamp(),
        ..Default::default()
    };
    
    db.create_credential(&credential)
        .map_err(|e| format!("创建失败: {}", e))?;
    
    Ok(credential)
}

// 类似的 get, update, delete 命令...

// ======== 连接测试 ========
#[command]
pub async fn test_server_connection(
    credential: Credential,
) -> Result<bool, String> {
    // 尝试 SSH 连接
    let host = credential.host.ok_or("没有主机地址")?;
    let port = credential.port.unwrap_or(22);
    let username = credential.username.ok_or("没有用户名")?;
    
    // 这里集成 SSH 客户端库
    // 例如: ssh2 crate
    // 返回连接是否成功
    
    Ok(true)
}

#[command]
pub async fn test_database_connection(
    credential: Credential,
) -> Result<bool, String> {
    // 尝试数据库连接
    let host = credential.host.ok_or("没有主机地址")?;
    let port = credential.port.unwrap_or(3306);
    let username = credential.username.ok_or("没有用户名")?;
    let metadata = credential.metadata.ok_or("缺少元数据")?;
    let db_type = metadata.get("db_type")
        .and_then(|v| v.as_str())
        .ok_or("没有数据库类型")?;
    
    match db_type {
        "mysql" => test_mysql_connection(&host, port, &username, &credential.secret_encrypted),
        "postgresql" => test_postgres_connection(&host, port, &username, &credential.secret_encrypted),
        _ => Err("不支持的数据库类型".to_string()),
    }
}

fn test_mysql_connection(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Result<bool, String> {
    // 使用 mysql crate 进行连接测试
    Ok(true)
}

fn test_postgres_connection(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Result<bool, String> {
    // 使用 postgres 或 tokio-postgres crate
    Ok(true)
}
```

---

## 🎨 前端主要组件示例

### CredentialsPage.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import CredentialsSidebar from './CredentialsSidebar';
import PasswordList from './PasswordList';
import ServerList from './ServerList';
import DatabaseList from './DatabaseList';
import ServiceList from './ServiceList';
import CredentialDetailsPanel from './CredentialDetailsPanel';

type CredentialType = 'password' | 'server' | 'database' | 'service';

export default function CredentialsPage() {
  const { vaultItems } = useApp();
  const [activeType, setActiveType] = useState<CredentialType>('password');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);

  const handleCreateNew = () => {
    setEditingCredential(null);
    setShowModal(true);
  };

  const handleEditCredential = (credential: any) => {
    setEditingCredential(credential);
    setShowModal(true);
  };

  const renderList = () => {
    switch (activeType) {
      case 'password':
        return (
          <PasswordList
            onSelect={setSelectedCredential}
            onEdit={handleEditCredential}
          />
        );
      case 'server':
        return (
          <ServerList
            onSelect={setSelectedCredential}
            onEdit={handleEditCredential}
          />
        );
      case 'database':
        return (
          <DatabaseList
            onSelect={setSelectedCredential}
            onEdit={handleEditCredential}
          />
        );
      case 'service':
        return (
          <ServiceList
            onSelect={setSelectedCredential}
            onEdit={handleEditCredential}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen">
      <CredentialsSidebar
        activeType={activeType}
        onTypeChange={setActiveType}
        onCreateNew={handleCreateNew}
      />
      
      <div className="flex-1 flex">
        {/* 左边: 列表 */}
        <div className="w-80 border-r border-surface2 overflow-y-auto">
          {renderList()}
        </div>

        {/* 右边: 详情面板 */}
        <div className="flex-1 overflow-y-auto">
          {selectedCredential ? (
            <CredentialDetailsPanel
              credential={selectedCredential}
              onEdit={() => handleEditCredential(selectedCredential)}
              onClose={() => setSelectedCredential(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text2">
              选择一个凭证查看详情
            </div>
          )}
        </div>
      </div>

      {/* 编辑模态框 */}
      {showModal && (
        <CredentialModal
          type={activeType}
          credential={editingCredential}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            // 刷新数据
          }}
        />
      )}
    </div>
  );
}
```

### ServerList.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, HardDrive, Cloud } from 'lucide-react';
import api from '../lib/tauri-api';

interface Server {
  id: string;
  title: string;
  host: string;
  port: number;
  username: string;
  environment: string;
  metadata: any;
}

export default function ServerList({
  onSelect,
  onEdit,
}: {
  onSelect: (server: any) => void;
  onEdit: (server: any) => void;
}) {
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, dev, test, prod

  useEffect(() => {
    loadServers();
  }, [filter]);

  const loadServers = async () => {
    try {
      const data = await api.getServerCredentials?.();
      setServers(data || []);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此服务器凭证?')) return;
    try {
      await api.deleteServerCredential?.(id);
      setServers(servers.filter((s) => s.id !== id));
    } catch (error) {
      alert(`删除失败: ${error}`);
    }
  };

  const cloudProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aliyun':
        return '☁️';
      case 'tencent':
        return '☁️';
      case 'aws':
        return '☁️';
      default:
        return '🖥️';
    }
  };

  const environmentColor = (env: string) => {
    switch (env) {
      case 'dev':
        return 'bg-blue-100 text-blue-800';
      case 'test':
        return 'bg-yellow-100 text-yellow-800';
      case 'prod':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text">🖥️ 服务器</h3>
        <button
          onClick={() => onEdit?.(null)}
          className="p-1 hover:bg-surface rounded"
          title="新建服务器"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 环境过滤 */}
      <div className="flex gap-1">
        {['all', 'dev', 'test', 'prod'].map((env) => (
          <button
            key={env}
            onClick={() => setFilter(env)}
            className={`px-2 py-1 text-xs rounded transition ${
              filter === env
                ? 'bg-accent text-white'
                : 'bg-surface text-text2 hover:bg-surface2'
            }`}
          >
            {env}
          </button>
        ))}
      </div>

      {/* 服务器列表 */}
      <div className="space-y-2">
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => onSelect(server)}
            className="p-3 rounded bg-surface hover:bg-surface2 cursor-pointer transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate">
                  {cloudProviderIcon(server.metadata?.cloud_provider)}{' '}
                  {server.title}
                </p>
                <p className="text-xs text-text2 truncate">{server.host}</p>
                <div className="flex gap-1 mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${environmentColor(
                      server.environment
                    )}`}
                  >
                    {server.environment}
                  </span>
                </div>
              </div>

              <div className="flex gap-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(server);
                  }}
                  className="p-1 hover:bg-accent hover:text-white rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(server.id);
                  }}
                  className="p-1 hover:bg-error hover:text-white rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {servers.length === 0 && !isLoading && (
        <p className="text-center text-text2 text-sm py-4">
          还没有添加服务器凭证
        </p>
      )}
    </div>
  );
}
```

### CredentialDetailsPanel.tsx

```tsx
import React from 'react';
import { Copy, Eye, EyeOff, Edit2, Lock } from 'lucide-react';
import api from '../lib/tauri-api';

export default function CredentialDetailsPanel({
  credential,
  onEdit,
  onClose,
}: {
  credential: any;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyPassword = async () => {
    try {
      await api.copyToClipboard?.(credential.secret_encrypted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('复制失败');
    }
  };

  const renderCredentialDetails = () => {
    switch (credential.type) {
      case 'server':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text2">IP 地址</label>
                <p className="font-mono text-text">{credential.host}</p>
              </div>
              <div>
                <label className="text-sm text-text2">端口</label>
                <p className="font-mono text-text">{credential.port || 22}</p>
              </div>
            </div>

            {credential.metadata?.private_ip && (
              <div>
                <label className="text-sm text-text2">内网 IP</label>
                <p className="font-mono text-text">
                  {credential.metadata.private_ip}
                </p>
              </div>
            )}

            {credential.metadata?.cloud_provider && (
              <div>
                <label className="text-sm text-text2">云服务商</label>
                <p className="text-text capitalize">
                  {credential.metadata.cloud_provider}
                </p>
              </div>
            )}

            {credential.metadata?.os && (
              <div>
                <label className="text-sm text-text2">操作系统</label>
                <p className="text-text">{credential.metadata.os}</p>
              </div>
            )}
          </>
        );

      case 'database':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text2">数据库类型</label>
                <p className="text-text capitalize">
                  {credential.metadata?.db_type}
                </p>
              </div>
              <div>
                <label className="text-sm text-text2">端口</label>
                <p className="font-mono text-text">{credential.port}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-text2">主机</label>
              <p className="font-mono text-text">{credential.host}</p>
            </div>

            <div>
              <label className="text-sm text-text2">数据库名</label>
              <p className="text-text">
                {credential.metadata?.database_name}
              </p>
            </div>
          </>
        );

      default:
        return (
          <div>
            <label className="text-sm text-text2">网址</label>
            <p className="text-text break-all">{credential.url}</p>
          </div>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-text">{credential.title}</h2>
          <p className="text-sm text-text2">{credential.category}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn btn-sm flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            编辑
          </button>
        </div>
      </div>

      {/* 凭证类型特定信息 */}
      <div className="space-y-4">{renderCredentialDetails()}</div>

      {/* 用户名和密码 */}
      <div className="space-y-2 border-t pt-4">
        {credential.username && (
          <div>
            <label className="text-sm text-text2">用户名</label>
            <p className="font-mono text-text">{credential.username}</p>
          </div>
        )}

        <div>
          <label className="text-sm text-text2">密码/密钥</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={credential.secret_encrypted}
              readOnly
              className="flex-1 px-3 py-2 rounded bg-surface text-text font-mono text-sm"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-2 hover:bg-surface rounded"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCopyPassword}
              className={`p-2 rounded transition ${
                copied ? 'bg-success text-white' : 'hover:bg-surface'
              }`}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 说明区域 (重要!) */}
      <div className="border-t pt-4">
        <label className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          说明和备注
        </label>
        <div className="bg-surface rounded p-3 min-h-24 whitespace-pre-wrap text-sm text-text">
          {credential.notes || '(无说明)'}
        </div>
      </div>

      {/* 元数据 */}
      {credential.environment && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-text2">环境:</span>
          <span
            className={`px-2 py-1 text-xs rounded capitalize ${
              credential.environment === 'prod'
                ? 'bg-red-100 text-red-800'
                : credential.environment === 'test'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
            }`}
          >
            {credential.environment}
          </span>
        </div>
      )}

      {credential.alert_contact && (
        <div className="text-sm">
          <label className="text-text2">紧急联系方式:</label>
          <p className="text-text">{credential.alert_contact}</p>
        </div>
      )}

      {/* 时间戳 */}
      <div className="text-xs text-text2 border-t pt-4">
        <p>创建于: {new Date(credential.created_at * 1000).toLocaleString()}</p>
        <p>更新于: {new Date(credential.updated_at * 1000).toLocaleString()}</p>
      </div>
    </div>
  );
}
```

---

## 🔄 迁移计划

### 现有密码数据的处理

```sql
-- 1. 添加新字段（nullable）
ALTER TABLE vault_items ADD COLUMN type VARCHAR(50) DEFAULT 'password';

-- 2. 设置现有数据
UPDATE vault_items SET type = 'password' WHERE type IS NULL;

-- 3. 添加约束
ALTER TABLE vault_items 
    MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'password',
    ADD CONSTRAINT check_type CHECK (type IN ('password', 'server', 'database', 'service'));
```

### 向后兼容性

```
✅ 保持现有密码管理功能不变
✅ 新功能通过 type 字段扩展可选
✅ UI 默认显示密码列表
✅ 旧版本可继续使用
```

---

##阶段计划

### Phase 1: 基础架构 (2 天)

**Day 1 - 数据库和后端**
- [ ] 更新 SQL 模式
- [ ] 实现 Credential 结构体
- [ ] 编写基本 CRUD API
- [ ] 实现连接测试命令

**Day 2 - 前端框架**
- [ ] 创建 AppContext 扩展
- [ ] 创建 Tab 结构
- [ ] 创建 Sidebar 组件
- [ ] 基本列表和详情面板

### Phase 2: 服务器管理 (2-3 天)

**Day 1-2 - 功能实现**
- [ ] ServerList 组件
- [ ] ServerModal 表单
- [ ] 服务器 CRUD 功能
- [ ] 基础详情面板

**Day 3 - 测试和优化**
- [ ] 本地测试
- [ ] UI 优化
- [ ] SSH 连接测试（可选）

### Phase 3: 数据库管理 (1-2 天)

**Day 1 - 功能实现**
- [ ] DatabaseList 组件
- [ ] DatabaseModal 表单
- [ ] 数据库 CRUD 功能

**Day 2 - 连接测试**
- [ ] MySQL 连接测试
- [ ] PostgreSQL 连接测试
- [ ] 连接字符串生成

### Phase 4: 其他服务 (1 天)

- [ ] ServiceList 组件
- [ ] ServiceModal 表单
- [ ] Redis/MQ/ELK 支持

### Phase 5: 优化和发布 (1-2 天)

- [ ] 搜索和过滤
- [ ] 性能优化
- [ ] 用户文档
- [ ] v0.2.0 发布

---

## ✅ 下一步

需要从您这里确认:

1. **架构确认**: 是否同意选项 C (扩展 vault_items)?
2. **优先顺序**: 是否按照建议的顺序实现?
3. **额外需求**: 是否有其他特殊的字段/功能需求?
4. **安全需求**: 是否需要添加访问日志和权限控制?

待确认后，我将开始实现 Phase 1 的代码。

---

**文档完成时间**: 2026-02-15
**预计总工作量**: 40-50 小时
**建议开始日期**: 2026-02-16
