# DevVault

开发者凭证管理器 - 视觉驱动、零操作成本的API Key管理工具

## 快速开始

### 环境要求
- Node.js 18+
- Rust 1.70+
- Tauri CLI

### 安装依赖
```bash
# 安装前端依赖
npm install

# 安装Rust依赖 (如果需要)
cd src-tauri && cargo build --release
```

### 开发模式
```bash
npm run tauri:dev
```

### 构建发布
```bash
npm run tauri:build
```

## 功能特性

### 核心功能
- ✅ 视觉驱动的界面设计
- ✅ Favicon自动抓取
- ✅ 项目分类管理
- ✅ 智能搜索
- ✅ 多格式复制 (原始/环境变量/JSON)
- ✅ 隐身模式
- ✅ 基础加密存储

### UI/UX
- 🎨 深色主题设计
- 📱 响应式布局
- ⚡ 快捷键支持
- 🎯 零学习成本

### 安全性
- 🔐 AES-256-GCM加密
- 🔑 Argon2密码哈希
- 🔒 隐身模式保护
- 🛡️ 本地存储，不上传数据

## 项目结构

```
devvault/
├── src/                     # 前端代码
│   ├── components/         # React组件
│   ├── contexts/           # React上下文
│   ├── lib/                # 工具函数
│   └── types/              # TypeScript类型
├── src-tauri/              # Rust后端
│   ├── src/
│   │   ├── commands.rs     # Tauri命令
│   │   ├── database.rs     # 数据库操作
│   │   └── crypto.rs       # 加密功能
│   └── Cargo.toml          # Rust依赖
└── docs/                   # 文档
    └── PRD.md             # 产品需求文档
```

## 开发状态

- ✅ 基础架构搭建
- ✅ UI组件开发
- ✅ 数据库集成
- ✅ 基础功能实现
- 🚧 密码解密功能 (需要实现)
- 🚧 编辑/新增功能 (需要实现)
- 🚧 拖拽导入 (需要实现)
- 🚧 剪贴板监听 (需要实现)

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri
- **数据库**: SQLite + SQLCipher
- **UI组件**: 自定义组件 + Lucide Icons
- **加密**: ring + AES-256-GCM

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 许可证

MIT License