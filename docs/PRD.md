DevVault (开发者凭证中枢) UX优化版 PRD

## 1. 产品定位与核心哲学
**定位**：视觉驱动、零操作成本的个人开发者API Key管理器

**哲学**：看图识别 > 文字阅读，智能预判 > 手动操作，格式化复制 > 原始粘贴

## 2. 交互与体验深度优化 (UX Deep Dive)

### 2.1 "视觉直觉"重于"文字阅读"

#### Favicon自动抓取
- **实现原理**：通过URL获取网站favicon.ico或Google Favicon API
- **展示效果**：列表视图中每个条目左侧显示32x32图标
- **识别速度**：0.5秒内视觉定位目标（OpenAI绿标、Anthropic红标）

#### 色块区分环境
- **项目色条**：左侧2px垂直色条，每个项目可自定义颜色
- **环境警示**：生产环境Key显示红色警告条，开发环境显示绿色
- **类型标识**：API Key蓝色、数据库密钥橙色、其他服务灰色

### 2.2 "零操作"录入 (Zero-Click Input)

#### 剪贴板智能监听
- **触发条件**：打开新建窗口时检测剪贴板
- **识别逻辑**：长度>20且包含特殊字符的字符串视为疑似API Key
- **自动填充**：弹窗提示"检测到可能的API Key，是否自动填入？"

#### 拖拽文件支持
- **支持格式**：.txt, .md, .csv文件拖入
- **智能解析**：自动识别文件中的key=value格式
- **快速导入**：弹窗勾选要保存的条目，一键批量创建

### 2.3 智能复制逻辑 (Smart Copy)

#### 多格式复制选项
- **Ctrl+C**：仅复制API Key原始值
- **Ctrl+Shift+C**：复制为环境变量格式 `export API_KEY='sk-...'`
- **Ctrl+Alt+C**：复制为JSON格式 `{"api_key": "sk-..."}`
- **右键菜单**：显示所有复制选项

#### 上下文感知复制
- **根据URL判断格式**：GitHub相关自动复制为`ghp_`开头
- **备注中的命令**：识别备注中的curl命令，直接复制完整命令

## 3. 界面设计升级 (UI Enhancement)

### 3.1 分屏布局
- **左侧**：项目树 + API Key列表（紧凑模式）
- **右侧**：详细信息面板（大字体备注区、URL预览、操作按钮）
- **响应式**：窗口小于800px时自动切换为单列模式

### 3.2 无感搜索
- **触发机制**：窗口获得焦点后直接打字即触发搜索
- **实时过滤**：输入即搜索，无需回车
- **快捷键保留**：Ctrl+K清空搜索框并聚焦

### 3.3 视觉层次
- **卡片设计**：微阴影 + 圆角，悬停时轻微上浮
- **状态反馈**：复制成功时绿色边框闪烁0.3秒
- **加载动画**：favicon加载时显示灰色占位符

## 4. 安全性补充 (Security Polish)

### 4.1 隐身模式 (Stealth Mode)
- **一键隐身**：点击眼镜图标，所有敏感信息变为`********`
- **模糊滤镜**：选项提供模糊效果而非完全隐藏
- **演示模式**：录屏时自动启用隐身模式

### 4.2 智能锁定逻辑
- **多样化锁定**：
  - 5分钟无操作自动锁定
  - 窗口最小化到托盘即锁定
  - 电脑休眠/锁屏即锁定
- **解锁方式**：主密码 + Windows Hello（可选）

## 5. 架构与技术栈 (Technical Stack)

### 5.1 前端技术
- **框架**：Tauri + React
- **UI库**：Tailwind CSS + Shadcn/ui
- **图标**：Lucide React + Favicon自动缓存
- **动画**：Framer Motion微交互

### 5.2 后端优化
- **加密**：Argon2哈希主密码，AES-256-GCM加密数据
- **数据库**：SQLite + SQLCipher
- **搜索引擎**：本地FTS5全文搜索

## 6. 高级功能特性

### 6.1 智能导入冲突处理
- **重复检测**：基于URL和Key长度判断重复
- **处理选项**：覆盖、跳过、重命名后导入
- **批量预览**：导入前显示所有将要添加的条目

### 6.2 环境变量自动识别
- **格式支持**：`.env`、`.bashrc`、`zshrc`文件解析
- **变量映射**：自动识别常见的API Key环境变量名
- **批量导入**：一键导入整个配置文件

## 7. 开发优先级重新规划

### **P0 (MVP核心)**
1. 基础增删改查 + Favicon获取
2. 分屏布局 + 色块区分
3. 智能复制（3种格式）
4. 无感搜索

### **P1 (体验升级)**
1. 剪贴板监听 + 拖拽导入
2. 隐身模式 + 智能锁定
3. 导入冲突处理
4. 微交互动画

### **P2 (完善体验)**
1. 环境变量识别
2. Windows Hello集成
3. 数据统计面板
4. 主题自定义

---

**架构师叮嘱**：使用Tauri + Tailwind CSS + Shadcn/ui的组合，能在短时间内打造出Apple风格的高级质感，让工具既实用又赏心悦目。

## 8. 数据库Schema (最终版)

-- 凭证表
CREATE TABLE vault (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    secret_encrypted BLOB NOT NULL, -- AES-256-GCM
    url TEXT,
    notes TEXT,
    category TEXT DEFAULT 'API',
    project_id INTEGER,
    color TEXT DEFAULT '#3b82f6', -- 项目色条
    favicon_url TEXT, -- 缓存的favicon地址
    is_archived INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- 项目表
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#10b981' -- 项目默认颜色
);

-- 设置表
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);