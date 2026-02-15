# 服务器&数据库凭证管理功能分析

**需求提出时间**: 2026-02-15  
**功能类型**: P1 核心扩展（超越 P0 MVP 范围）  
**影响范围**: 数据模型、UI 结构、数据库模式  

---

## 📋 需求分析

### 用户需求总结

**核心需求**:
1. 记录云服务器信息（服务商、IP、用户名、密码）
2. 记录数据库信息（数据库类型、地址、端口、用户名、密码）
3. 在左侧单独创建区域显示
4. 支持项目关联
5. 增加备注/说明字段

**应用场景**:
- 云服务商管理：阿里云、腾讯云、火山引擎等
- 服务器信息：IP、SSH 端口、登录凭证
- 数据库：MySQL、PostgreSQL、MongoDB 等
- 其他服务：Redis、消息队列等

---

## 🎯 需求细化

### 想要记录的凭证类型

#### 1. 云服务器 (Cloud Servers)
```
信息字段:
├─ 服务商      (云服务商类型)
├─ 服务器名称  (标识)
├─ IP 地址     (公网/内网)
├─ 端口        (SSH 端口，通常 22)
├─ 用户名      (root/ubuntu/ec2-user 等)
├─ 密码/密钥   (SSH 密钥或密码)
├─ 密钥路径    (如提供 SSH 密钥)
├─ 地域        (region)
├─ 项目        (关联)
└─ 说明        (备注)
```

**云服务商类型**:
- ☁️ 阿里云 (Aliyun)
- ☁️ 腾讯云 (Tencent Cloud)
- ☁️ 火山引擎 (Volcano Engine)
- ☁️ AWS (Amazon)
- ☁️ Azure (Microsoft)
- ☁️ Google Cloud
- ☁️ 其他 (自定义)

#### 2. 数据库 (Databases)
```
信息字段:
├─ 数据库类型  (MySQL/PostgreSQL/MongoDB 等)
├─ 数据库名    (标识)
├─ 主机/地址   (域名或 IP)
├─ 端口        (3306/5432 等)
├─ 用户名      (root/postgres 等)
├─ 密码        (加密存储)
├─ 数据库名    (特定数据库名)
├─ 连接字符串  (可选的完整连接字符串)
├─ 项目        (关联)
├─ 环境        (开发/测试/生产)
└─ 说明        (备注)
```

**数据库类型**:
- 🗄️ MySQL / MariaDB
- 🗄️ PostgreSQL
- 🗄️ MongoDB
- 🗄️ Redis
- 🗄️ SQLServer
- 🗄️ Oracle
- 🗄️ 其他

#### 3. 其他服务 (Other Services)
```
信息字段:
├─ 服务类型    (MQ/缓存/API 等)
├─ 服务名      (标识)
├─ 地址        (IP/域名)
├─ 端口        (非标准端口)
├─ 用户名      (如需要)
├─ 密码/Token  (凭证)
├─ 项目        (关联)
└─ 说明        (备注)

服务类型示例:
├─ 消息队列: RabbitMQ, Kafka, Redis Queue
├─ 缓存服务: Redis, Memcached
├─ API 服务: GraphQL, REST Endpoints
└─ 其他服务: Elasticsearch, Prometheus 等
```

---

## 🏗️ 架构影响分析

### 现有架构 (P0)
```
Vault Item (密码)
├─ Title
├─ Username
├─ Password (secret_encrypted)
├─ URL
├─ Category
└─ Project (FK)
```

### 提议的新架构

#### 选项 A: 统一的凭证系统 ⭐ 推荐
```
Credentials (基础表)
├─ ID
├─ Type (password/server/database/service)
├─ Title
├─ Project (FK)
├─ Category
├─ Encrypted_Data (JSON)
├─ Metadata
└─ Timestamp

优点:
✅ 统一存储和管理
✅ 灵活的字段支持
✅ 便于搜索和过滤
✅ 代码复用高

缺点:
❌ JSON 存储不够结构化
❌ 字段验证复杂
```

#### 选项 B: 分离的表结构 ⭐ 更规范
```
vault_items (现有，仅密码)
├─ ID, Title, Username, Secret, ...

servers (新)
├─ ID, Name, IP, Port, Username, Secret, ...

databases (新)
├─ ID, Name, Type, Host, Port, ...

services (新)
├─ ID, Name, Type, Host, Port, ...

优点:
✅ 结构清晰
✅ 字段明确
✅ 验证容易
✅ 查询高效

缺点:
❌ 需要更多表
❌ UI 管理复杂
```

#### 选项 C: 混合方案 ⭐⭐ 最优
```
vault_items (改造)
├─ ID
├─ Type (password/server/database/service) ← 新增
├─ Title
├─ Category
├─ Project (FK)
├─ Metadata (JSON) ← 新增，存储类型特定字段
├─ Encrypted_Primary ← 主密码/密钥字段
├─ Encrypted_Secondary ← 备用凭证字段
├─ URL/Host
├─ Port
├─ Username
├─ Notes
└─ Timestamps

优点:
✅ 兼容现有 vault_items 表
✅ 灵活支持多种类型
✅ 字段结构清晰
✅ 最小化迁移成本
✅ UI 统一管理

缺点:
⚠️ 某些字段对某些类型可能不适用
```

---

## 🎨 UI 结构设计

### 当前 UI 布局
```
┌─────────────────────────────────────┐
│         DevVault Header             │
├──────────┬──────────────────────────┤
│ Sidebar  │      Main Content        │
│          │                          │
│Projects  │  Vault Items (密码列表)  │
│          │                          │
│  ├─ P1   │  ┌─ Item 1              │
│  ├─ P2   │  ├─ Item 2              │
│  └─ P3   │  └─ Item 3              │
│          │                          │
└──────────┴──────────────────────────┘
```

### 提议的新 UI 布局 (方案 1: 扩展 Sidebar)
```
┌──────────────────────────────────────┐
│         DevVault Header              │
├──────────────┬───────────────────────┤
│   Sidebar    │    Main Content       │
│              │                       │
│ 📦 Projects  │ 📋 Vault Items      │
│  ├─ P1       │ ┌─ Item 1           │
│  ├─ P2       │ ├─ Item 2           │
│  └─ P3       │ └─ Item 3           │
│              │                       │
│ 🖥️ Servers   │                       │
│  ├─ Ali 云   │ 🖥️ Server Details   │
│  ├─ Tencent  │ ┌─ Name: web-001    │
│  └─ AWS      │ ├─ IP: 1.2.3.4      │
│              │ ├─ Port: 22         │
│ 🗄️ Databases │ └─ User: ubuntu     │
│  ├─ MySQL    │                       │
│  ├─ PG       │                       │
│  └─ Mongo    │                       │
│              │                       │
│ 🔗 Services  │                       │
│  ├─ Redis    │                       │
│  ├─ MQ       │                       │
│  └─ API      │                       │
│              │                       │
└──────────────┴───────────────────────┘
```

### 提议的新 UI 布局 (方案 2: Tab 页签)
```
┌──────────────────────────────────────┐
│         DevVault Header              │
├─ Passwords │ Servers │ Databases ────┤
│            │         │                │
│ 📦 Project │ 🖥️ List │ 🗄️ List      │
│  ├─ P1     │ ├─ Ali  │ ├─ MySQL   │
│  ├─ P2     │ ├─ Ten  │ ├─ PG      │
│  └─ P3     │ └─ AWS  │ └─ Mongo   │
│            │         │                │
│ 📋 Items   │ Details │ Details      │
│ ┌─ Item 1  │ ┌─ Ali-1 Details     │
│ ├─ Item 2  │ └─ ...                │
│ └─ Item 3  │                        │
│            │                        │
└──────────────────────────────────────┘
```

### 🌟 **推荐方案: Tab + 增强 Sidebar**
```
┌──────────────────────────────────────┐
│         DevVault Header              │
├─ 📋 Credentials │ 📊 Analytics ──────┤
│                 │                    │
│  🔑 Passwords   │                    │
│  ├─ Project 1   │  🖥️ Servers       │
│  │  ├─ Gmail    │  ├─ Ali-001       │
│  │  └─ GitHub   │  ├─ AWS-001       │
│  ├─ Project 2   │  └─ Tencent-001   │
│  │  ├─ Work     │                    │
│  │  └─ Home     │  🗄️ Databases    │
│  └─ Others      │  ├─ Pool-1        │
│                 │  └─ Pool-2        │
│  🖥️ Servers     │                    │
│  ├─ Ali Cloud   │  🔗 Services      │
│  ├─ Tencent     │  ├─ Redis         │
│  └─ AWS         │  └─ MQ            │
│                 │                    │
│  🗄️ Databases   │  Details Panel    │
│  ├─ MySQL       │  ┌────────────┐   │
│  ├─ PostgreSQL  │  │ 详细信息   │   │
│  └─ MongoDB     │  │ + 说明     │   │
│                 │  └────────────┘   │
│  🔗 Services    │                    │
│  ├─ Redis       │                    │
│  ├─ RabbitMQ    │                    │
│  └─ Kafka       │                    │
│                 │                    │
└──────────────────────────────────────┘
```

---

## 📝 说明区域 (Note/Description Section)

### 为什么需要说明区域

```
服务器条目: api-server-001
说明:
- 用于生产环境 API 服务器
- 由 DevOps 团队维护
- 更新时间: 2026-02-10
- 关键信息: 不可关闭，生产流量使用
- SSH 密钥储存在密钥管理系统
- 紧急联系: DevOps Lead (xxx@company.com)

优点:
✅ 记录重要运维信息
✅ 防止误操作
✅ 版本控制和变更日志
✅ 权限管理信息
✅ 应急联系方式
```

### 说明字段设计

```
Notes/Description
├─ 基本信息
│  ├─ 用途描述
│  ├─ 环境 (开发/测试/生产)
│  ├─ 所有者/team
│  └─ 最后更新时间
├─ 运维信息
│  ├─ 维护人员
│  ├─ 联系方式
│  ├─ 告警规则
│  └─ 备灾信息
└─ 变更日志
   ├─ 密码更新记录
   ├─ 配置变更
   └─ 访问权限变更
```

---

## 🔄 数据字段完整设计

### 服务器信息 (Server Credential)

```rust
ServerCredential {
    id: String,
    title: String,
    cloud_provider: String,        // 云服务商
    server_type: String,           // ECS/轻量/物理机 等
    
    network: {
        public_ip: String,         // 公网 IP
        private_ip: String,        // 内网 IP
        port: u16,                 // SSH 端口
        region: String,            // 地域
        availability_zone: String, // 可用区
    },
    
    credentials: {
        username: String,
        password: String,          // 加密
        ssh_key: Option<String>,   // 加密
        key_passphrase: Option<String>, // 加密
    },
    
    metadata: {
        os: String,                // 操作系统
        cpu: String,               // CPU 规格
        ram: String,               // 内存
        storage: String,           // 存储
        public_ip_bandwidth: String, // 公网带宽
    },
    
    management: {
        project_id: String,
        category: String,
        owner: String,
        environment: String,       // 开发/测试/生产
        created_at: Timestamp,
        updated_at: Timestamp,
        last_accessed: Option<Timestamp>,
    },
    
    notes: String,                 // 说明/备注
    tags: Vec<String>,            // 标签
    alert_contact: Option<String>, // 紧急联系方式
}
```

### 数据库信息 (Database Credential)

```rust
DatabaseCredential {
    id: String,
    title: String,
    db_type: String,              // MySQL/PostgreSQL/MongoDB 等
    
    connection: {
        host: String,
        port: u16,
        username: String,
        password: String,          // 加密
    },
    
    database: {
        database_name: String,
        connection_string_template: String, // 可选
        charset: String,           // utf8mb4 等
        collation: String,         // utf8mb4_unicode_ci 等
    },
    
    pool_config: Option<{
        min_connections: u32,
        max_connections: u32,
        timeout: u32,
        idle_timeout: u32,
    }>,
    
    metadata: {
        version: String,           // 数据库版本
        replication_role: String,  // master/slave 等
        backup_time: String,       // 备份时间
        recovery_point_objective: String, // RPO
    },
    
    management: {
        project_id: String,
        category: String,
        environment: String,       // 开发/测试/生产
        owner: String,
        created_at: Timestamp,
        updated_at: Timestamp,
    },
    
    notes: String,                 // 说明
    backup_contact: Option<String>, // 备份/恢复联系人
    maintenance_window: Option<String>, // 维护窗口
}
```

### 通用服务 (Generic Service Credential)

```rust
ServiceCredential {
    id: String,
    title: String,
    service_type: String,         // Redis/RabbitMQ/Kafka 等
    
    connection: {
        host: String,
        port: u16,
        username: Option<String>,
        password: Option<String>,  // 加密
        auth_token: Option<String>, // 加密
    },
    
    configuration: {
        use_ssl: bool,
        use_tls: bool,
        certificate_path: Option<String>,
        connection_string: Option<String>,
    },
    
    metadata: {
        version: String,
        cluster: Option<String>,
        replicas: Option<u32>,
    },
    
    management: {
        project_id: String,
        category: String,
        environment: String,
        owner: String,
        created_at: Timestamp,
        updated_at: Timestamp,
    },
    
    notes: String,
    monitoring_url: Option<String>, // 监控面板链接
}
```

---

## 💾 数据库模式变更

### 选项 C (推荐): 扩展 vault_items

```sql
-- 原表保持不变，添加新字段
ALTER TABLE vault_items ADD COLUMN (
    type VARCHAR(50) DEFAULT 'password',  -- password, server, database, service
    port INTEGER,
    host VARCHAR(255),
    environment VARCHAR(50),              -- dev, test, prod
    metadata JSON,                        -- 类型特定字段
    secondary_password VARCHAR(512),      -- 备用密码/token
    key_material TEXT,                    -- SSH 密钥等
    alert_contact VARCHAR(255),
    description TEXT
);

-- 创建类型索引以加快查询
CREATE INDEX idx_vault_type ON vault_items(type);
CREATE INDEX idx_vault_environment ON vault_items(environment);
```

### 迁移策略
```
1. 添加新字段 (nullable)
2. 现有数据保持 type='password'
3. 新增的数据根据类型填充
4. UI 兼容两种版本
5. 逐步迁移历史数据
```

---

## 🎯 实现优先级

### Phase 1: 基础服务器管理 (P1)
```
功能:
- [x] 数据库模式更新
- [ ] 服务器凭证 CRUD
- [ ] UI: 服务器列表
- [ ] UI: 服务器详情面板
- [ ] 项目关联
- [ ] 说明区域

时间: 2-3 天
```

### Phase 2: 数据库信息管理 (P2)
```
功能:
- [ ] 数据库凭证 CRUD
- [ ] UI: 数据库列表
- [ ] 连接字符串生成
- [ ] 连接池配置

时间: 1-2 天
```

### Phase 3: 其他服务管理 (P2)
```
功能:
- [ ] 通用服务 CRUD
- [ ] UI: 服务列表
- [ ] 多种服务类型支持

时间: 1 天
```

### Phase 4: 增强功能 (P3)
```
功能:
- [ ] 批量导入/导出
- [ ] 连接测试
- [ ] 监控集成
- [ ] 变更历史记录

时间: 2-3 天
```

---

## 📊 对现有代码的影响

### 后端 (Rust)

#### 1. 数据库迁移 (Tauri)
```
src-tauri/src/database.rs:
- 修改: 现有 VaultItem 结构体
  ├─ 添加 type 字段
  ├─ 添加 optional 字段
  └─ 保持向后兼容

- 新增: get_servers, get_databases, get_services
- 新增: create_server, update_server, delete_server
- 新增: create_database, update_database, delete_database
```

#### 2. API 命令 (Tauri Commands)
```
src-tauri/src/commands.rs:
- 新增: read_chrome_servers (可选)
- 新增: get_server_list
- 新增: create_server
- 新增: update_server
- 新增: delete_server
- 类似: 数据库和服务的对应命令
- 新增: test_server_connection
- 新增: test_database_connection
```

### 前端 (React)

#### 1. 组件结构
```
src/components/
├─ CredentialsTabs.tsx     (新增 tabs 容器)
├─ ServerList.tsx          (新增 服务器列表)
├─ ServerModal.tsx         (新增 服务器编辑)
├─ DatabaseList.tsx        (新增 数据库列表)
├─ DatabaseModal.tsx       (新增 数据库编辑)
├─ ServiceList.tsx         (新增 服务列表)
├─ ServiceModal.tsx        (新增 服务编辑)
├─ CredentialDetails.tsx   (新增 详情面板)
└─ VaultList.tsx           (修改 支持多种类型)
```

#### 2. Context 和 Hooks
```
src/contexts/AppContext.tsx:
- 修改: 支持多种凭证类型
- 新增: Actions for servers/databases/services

src/hooks/useCredentials.ts: (新增)
- 通用的凭证管理 hook
- 支持所有凭证类型
```

#### 3. 样式和图标
```
src/styles/
- 新增: 服务器、数据库图标
- 新增: 环境标签样式 (dev/test/prod)

Lucide Icons:
- Server, Database, Zap (服务)
- Cloud, HardDrive (云计算)
```

---

## 🔄 用户工作流

### 创建服务器凭证
```
1. 点击 "🖥️ Servers" → "+ 新建"
2. 选择云服务商 (下拉选择)
3. 填写基本信息
   ├─ 服务器名称
   ├─ 公网/内网 IP
   ├─ SSH 端口
   └─ 登录凭证 (密码或密钥)
4. 填写元数据 (可选)
   ├─ OS 类型
   ├─ CPU/内存
   └─ 地域
5. 选择项目和环境
6. 添加说明和紧急联系方式
7. 保存
```

### 创建数据库凭证
```
1. 点击 "🗄️ Databases" → "+ 新建"
2. 选择数据库类型 (下拉选择)
3. 填写连接信息
   ├─ 主机
   ├─ 端口
   ├─ 用户名
   └─ 密码
4. 填写数据库名和连接参数
5. 配置连接池 (可选)
6. 选择项目和环境
7. 添加说明、备份联系人、维护窗口
8. 保存 + 测试连接
```

### 使用说明区域
```
编辑任何凭证时:
1. 滚动到底部找到 "说明" 区域
2. 记录关键信息
   ├─ 用途和限制
   ├─ 维护人员和联系方式
   ├─ 重要的运维信息
   └─ 变更记录
3. 说明自动保存
4. 其他人可以看到完整的背景信息
```

---

## ⚠️ 安全考虑

### 1. 敏感信息加密
```
需要加密存储的字段:
✅ 密码
✅ SSH 密钥和 passphrase
✅ 连接字符串 (可能包含密码)
✅ Auth tokens
✅ API 密钥

保持不加密:
⚠️ 主机名/IP (需要根据存储来源判断)
⚠️ 用户名 (可能不敏感)
⚠️ 端口 (公开信息)
```

### 2. 访问控制
```
建议: 基于项目的权限控制
- 只能查看有权访问的项目下的凭证
- 不同项目不同权限
- 管理员可以审计访问记录
```

### 3. 审计日志
```
记录:
- 谁创建/修改了凭证
- 什么时间
- 修改了什么字段
- 谁查看了密码
- 复制/导出操作
```

---

## 🚀 建议的实现路线

### 第 1 阶段: 基础架构 (2 天)
```
1. 更新数据库模式
2. 更新 Rust 数据结构
3. 实现基本的 CRUD API
4. UI: 标签页结构
```

### 第 2 阶段: 服务器管理 (2-3 天)
```
1. 服务器列表组件
2. 服务器编辑对话框
3. 项目关联
4. 说明区域
```

### 第 3 阶段: 数据库管理 (1-2 天)
```
1. 数据库列表组件
2. 数据库编辑对话框
3. 连接测试功能
4. 连接字符串生成
```

### 第 4 阶段: 其他服务 (1 天)
```
1. Redis、MQ 等支持
2. 通用服务管理
```

### 第 5 阶段: 优化和增强 (1-2 天)
```
1. 批量操作
2. 导入/导出
3. 搜索和过滤
4. 权限和审计
```

---

## 📈 功能对比

### 现有 MVP (P0)
```
功能范围: 仅密码管理
- ✅ 网站账户密码
- ✅ 邮箱密码
- ✅ API 密钥

不支持:
- ❌ 服务器信息
- ❌ 数据库凭证
- ❌ 备注字段
```

### 扩展版 (P1+)
```
功能范围: 全面凭证管理
- ✅ 账户密码 (现有)
- ✅ 服务器信息 (新)
- ✅ 数据库凭证 (新)
- ✅ 其他服务 (新)
- ✅ 详细说明 (新)
- ✅ 项目关联
- ✅ 环境标记
- ✅ 连接测试
```

---

## 💡 相关的未来功能

### 可以进一步添加的功能
```
1. 连接直接集成
   - SSH 终端集成
   - 数据库客户端集成
   - Redis 内存查看

2. 监控和告警
   - 服务器状态监控
   - 数据库性能指标
   - 连接异常告警

3. 自动化和集成
   - Ansible 剧本生成
   - Terraform IaC 生成
   - CI/CD 管道集成

4. 协作功能
   - 权限管理
   - 审计日志
   - 共享和委托
   - 变更通知
```

---

## 📊 工作量估计

| 功能 | 后端 | 前端 | 数据库 | 总计 |
|------|------|------|--------|------|
| 基础架构 | 4h | 2h | 1h | 7h |
| 服务器管理 | 4h | 6h | - | 10h |
| 数据库管理 | 4h | 6h | - | 10h |
| 服务管理 | 2h | 4h | - | 6h |
| 测试和优化 | 2h | 3h | 1h | 6h |
| **总计** | **16h** | **21h** | **2h** | **~40h** |

**预计时间: 1 周 (5 个工作日)**

---

## 🎓 建议

### 1. **优先顺序**
从最迫切的需求开始:
1. ✅ 服务器信息管理 (最常用)
2. ✅ 数据库信息管理 (次常用)
3. ⚠️ 其他服务管理 (可以延后)

### 2. **架构建议**
使用 **选项 C (混合方案)** 最平衡:
- 兼容现有数据
- 灵活扩展新类型
- UI 统一管理
- 最小化迁移成本

### 3. **UI 建议**
采用 **Tab + 增强 Sidebar** 的方案:
- 左侧 Sidebar 显示分类
- 中间 Tab 或列表区
- 右侧详情面板
- 说明区域在底部

### 4. **实现建议**
- ✅ 先完成基础框架
- ✅ 然后添加服务器管理
- ✅ 最后添加其他类型
- ✅ 逐步迭代，收集反馈

---

## 📋 后续行动

1. **确认需求** ✅ 本分析完成
2. **选择架构** → 需要您确认选项 C
3. **创建详细设计文档** → 针对每种凭证类型
4. **创建实现计划** → 分阶段实现路线图
5. **开始开发** → 从基础架构开始

---

**文档完成时间**: 2026-02-15  
**建议讨论**: 
- [ ] 架构选择 (A/B/C)
- [ ] UI 布局确认
- [ ] 优先顺序调整
- [ ] 额外安全需求
