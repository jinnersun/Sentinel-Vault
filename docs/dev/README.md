# DevVault 开发文档索引

## 📚 文档概述

本目录包含 DevVault 项目的完整开发文档，涵盖7个优先实现的功能特性。

---

## 🎯 优先级功能完整设计

### P1 - 关键功能 (2-4 周内完成)

#### 1️⃣ [Chrome 密码导入](CHROME_IMPORT.md) ⏱️ 3-4 天
**优先级**: 最高 | **复杂度**: ⭐⭐ 中等

从 Chrome 浏览器导入保存的密码到 DevVault。

**关键技术**:
- SQLite 数据库读取 (rusqlite)
- 密码解密（DPAPI/Keychain）
- 大数据量导入处理

**实现步骤**:
1. 后端：添加 `read_chrome_passwords` Tauri 命令
2. 前端：创建 ImportDialog 组件
3. 修改：tauri-api.ts 添加 API 调用

**输出物**:
- `/src-tauri/src/commands.rs` - 新增读取 Chrome 密码的函数
- `/src/components/ImportDialog.tsx` - 导入对话框
- `docs/dev/CHROME_IMPORT.md` ✅

---

#### 2️⃣ [剪贴板监听器修复](CLIPBOARD_FIX.md) ⏱️ 30 分钟
**优先级**: 高 | **复杂度**: ⭐ 简单

自动检测剪贴板内容并提示导入。

**关键技术**:
- Clipboard API
- 定时检查 (setInterval)
- 敏感信息检测

**实现步骤**:
1. 创建 `useClipboardMonitor` hook
2. 在 ItemModal 中集成
3. 添加自动填充UI提示

**输出物**:
- `/src/hooks/useClipboardMonitor.ts` - 新增
- `/src/components/ItemModal.tsx` - 修改
- `docs/dev/CLIPBOARD_FIX.md` ✅

---

#### 3️⃣ [导入冲突处理](CONFLICT_HANDLING.md) ⏱️ 1-2 天
**优先级**: 高 | **复杂度**: ⭐⭐ 中等

处理导入重复项、部分匹配项等冲突。

**关键技术**:
- 相似度算法 (Levenshtein 距离)
- 复杂的数据库查询
- 冲突分析和推荐

**实现步骤**:
1. 后端：实现 `analyze_import_conflicts` 和 `resolve_import_conflicts`
2. 前端：创建 `ImportConflictScreen` 组件
3. 集成：将冲突分析加入导入流程

**输出物**:
- `/src-tauri/src/commands.rs` - 新增冲突处理逻辑
- `/src/components/ImportConflictScreen.tsx` - 新增
- `docs/dev/CONFLICT_HANDLING.md` ✅

---

#### 4️⃣ [智能自动锁定](SMART_AUTOLOCK.md) ⏱️ 1-1.5 天
**优先级**: 高 | **复杂度**: ⭐⭐ 中等

应用最小化、空闲超时、系统唤醒等条件下自动锁定。

**关键技术**:
- 事件监听 (Window Focus, Minimize)
- 定时器管理
- 配置持久化

**实现步骤**:
1. 后端：创建 `config.rs` 和自动锁定命令
2. 前端：创建 `useAutoLock` hook 和设置面板
3. AppContext：添加 AUTO_LOCK 处理

**输出物**:
- `/src-tauri/src/config.rs` - 新增
- `/src-tauri/src/commands.rs` - 新增锁定命令
- `/src/hooks/useAutoLock.ts` - 新增
- `/src/components/SettingsPanel.tsx` - 修改
- `docs/dev/SMART_AUTOLOCK.md` ✅

---

### P2 - 增强功能 (2-3 周内完成)

#### 5️⃣ [隐身模式选项](STEALTH_MODES.md) ⏱️ 6-8 小时
**优先级**: 中 | **复杂度**: ⭐⭐ 中等

支持多种隐身模式：标准、屏幕锁定、工作场所、演示、访客。

**关键技术**:
- 条件渲染
- 访问控制中间件
- 虚拟数据生成

**实现步骤**:
1. 后端：实现隐身模式命令和虚拟数据
2. 前端：创建 `useStealth` hook 和模式选择UI
3. 分散：在 VaultList 和 ItemModal 中应用模式

**输出物**:
- `/src-tauri/src/commands.rs` - 新增隐身模式命令
- `/src/hooks/useStealth.ts` - 新增
- `/src/components/StealthModePanel.tsx` - 新增
- `/src/components/VaultList.tsx` - 修改
- `docs/dev/STEALTH_MODES.md` ✅

---

#### 6️⃣ [数据统计面板](STATS_PANEL.md) ⏱️ 1.5 天
**优先级**: 中 | **复杂度**: ⭐⭐ 中等

显示安全指标、分类分布、活动日志等。

**关键技术**:
- 数据聚合查询
- Recharts 图表库
- 活动日志系统

**实现步骤**:
1. 后端：添加统计收集命令和活动日志表
2. 前端：创建 StatsDashboard 组件
3. 集成：在 MainLayout 中添加菜单项

**输出物**:
- `/src-tauri/src/commands.rs` - 新增统计命令
- 数据库：新增 activity_log 表
- `/src/components/StatsDashboard.tsx` - 新增
- `docs/dev/STATS_PANEL.md` ✅

---

#### 7️⃣ [主题自定义](THEME_CUSTOMIZATION.md) ⏱️ 8-11 小时
**优先级**: 中 | **复杂度**: ⭐⭐ 中等

支持深色模式、高对比度、自定义颜色、字体缩放。

**关键技术**:
- CSS 变量系统
- React Context API
- System Theme Detection

**实现步骤**:
1. 后端：主题配置管理和预设
2. 前端：创建 ThemeContext 和 ThemeSettingsPanel
3. 样式：建立 CSS 变量系统

**输出物**:
- `/src-tauri/src/commands.rs` - 新增主题命令
- `/src/contexts/ThemeContext.tsx` - 新增
- `/src/components/ThemeSettingsPanel.tsx` - 新增
- `/src/styles/globals.css` - 修改添加CSS变量
- `docs/dev/THEME_CUSTOMIZATION.md` ✅

---

## 📊 实现时间线建议

```
Week 1:
  Day 1-2: Chrome 导入 (并行开发后端和前端)
  Day 3:   剪贴板监听器修复 (快速功能)
  Day 4-5: 导入冲突处理 (后端算法 + UI)

Week 2:
  Day 1-2: 智能自动锁定 (事件系统)
  Day 3-4: 隐身模式选项 (条件渲染)
  Day 5:   数据统计面板 (前半部分)

Week 3:
  Day 1:   数据统计面板 (完成)
  Day 2-4: 主题自定义 (CSS系统)
  Day 5:   集成测试 + Bug修复
```

---

## 🏗️ 技术架构

### 后端栈 (Rust/Tauri)
```
src-tauri/
├── src/
│   ├── main.rs          # 入口、窗口事件处理
│   ├── commands.rs      # Tauri 命令处理
│   ├── config.rs        # 配置系统 (新增)
│   ├── database.rs      # SQLite 操作
│   ├── crypto.rs        # 加密算法
│   └── build.rs         # 构建脚本
└── Cargo.toml          # 依赖管理
```

**关键依赖**:
- tauri 1.5
- rusqlite 0.29
- serde_json
- dirs 5.0
- clipboard-win 5.4

### 前端栈 (React/TypeScript)
```
src/
├── components/
│   ├── ImportDialog.tsx           # 新增
│   ├── ImportConflictScreen.tsx   # 新增
│   ├── StealthModePanel.tsx       # 新增
│   ├── StatsDashboard.tsx         # 新增
│   ├── ThemeSettingsPanel.tsx     # 新增
│   ├── SettingsPanel.tsx          # 修改
│   └── ...
├── contexts/
│   ├── AppContext.tsx
│   └── ThemeContext.tsx           # 新增
├── hooks/
│   ├── useClipboardMonitor.ts     # 新增
│   ├── useStealth.ts             # 新增
│   ├── useAutoLock.ts            # 新增
│   └── ...
├── lib/
│   ├── tauri-api.ts              # 修改 (新增API)
│   └── ...
└── styles/
    └── globals.css               # 修改 (CSS变量)
```

**关键依赖**:
- react 18
- recharts 2.10 (新增，用于图表)
- @tauri-apps/api
- lucide-react

---

## 🔄 开发工作流

### 每个功能的实现流程

1. **设计阶段** 📋
   - 阅读相应的 md 文档
   - 理解 API 契约和数据模型
   - 规划文件修改点

2. **后端开发** 🦀
   - 在 `src-tauri/src/commands.rs` 中添加命令
   - 必要时添加新文件 (如 config.rs)
   - 修改 `src-tauri/src/main.rs` 以支持新功能
   - 运行 `cargo check` 编译检查

3. **前端开发** ⚛️
   - 创建新组件或修改现有组件
   - 在 hooks 中实现业务逻辑
   - 修改 `src/lib/tauri-api.ts` 添加新 API

4. **集成测试** ✅
   - 运行 `npm run dev:tauri` 启动开发服务器
   - 手动测试新功能
   - 检查控制台错误和警告

5. **代码审查** 👀
   - 检查代码风格一致性
   - 验证错误处理完整性
   - 确保性能没有退化

6. **文档更新** 📝
   - 更新 ROADMAP.md 标记功能为完成
   - 添加新 API 到 API 文档（如有）
   - 更新 CHANGELOG

---

## 🚀 快速开始

### 环境设置

```bash
# 克隆仓库
git clone https://github.com/jinnersun/aipassword.git
cd aipassword

# 配置环境
npm install
cargo fetch

# 启动开发服务器
npm run dev:tauri
```

### 实现第一个功能

```bash
# 1. 选择一个功能（从简单到难）
# 建议顺序: 剪贴板修复 → 隐身模式 → 主题自定义 → ...

# 2. 打开对应的文档
code docs/dev/CLIPBOARD_FIX.md

# 3. 创建新文件或修改现有文件
# 按文档指示进行

# 4. 测试更改
npm run dev:tauri

# 5. 提交代码
git add .
git commit -m "feat: implement clipboard auto-detection"
git push origin feature/clipboard-monitor
```

---

## 📋 检查清单

### 开发前
- [ ] 仔细阅读对应的设计文档
- [ ] 理解所有涉及的数据结构
- [ ] 列出需要修改的文件清单
- [ ] 检查是否有依赖冲突

### 开发中
- [ ] 实现后端命令
- [ ] 实现前端组件/hooks
- [ ] 集成 API 调用
- [ ] 添加错误处理
- [ ] 本地测试无误

### 开发后
- [ ] 代码格式检查 (`cargo fmt`, `npm run lint`)
- [ ] 编译检查 (`cargo check`)
- [ ] 完整测试（按文档测试清单）
- [ ] 更新文档（ROADMAP.md, CHANGELOG）
- [ ] 提交 PR 或合并到 main

---

## 🔗 相关资源

### 现有项目文档
- [README.md](../../README.md) - 项目概述
- [DEVELOPMENT.md](../../DEVELOPMENT.md) - 开发指南
- [ROADMAP.md](ROADMAP.md) - 功能路线图

### 分析文档
- [ANALYSIS_PASSWORD_FLOW.md](ANALYSIS_PASSWORD_FLOW.md) - 密码流程分析
- [FEATURES_CHECKLIST.md](FEATURES_CHECKLIST.md) - P0 功能检查清单

### 外部资源
- [Tauri 文档](https://tauri.app/docs/)
- [React 文档](https://react.dev/)
- [Rust 图书](https://doc.rust-lang.org/)

---

## 📞 常见问题

### Q: 应该从哪个功能开始?
**A**: 从 **剪贴板监听器修复** 开始（最简单）。然后按这个顺序：
1. 剪贴板监听器 (30 分钟)
2. 隐身模式 (6-8 小时)
3. 主题自定义 (8-11 小时)
4. Chrome 导入 (3-4 天)
5. 导入冲突 (1-2 天)
6. 统计面板 (1.5 天)
7. 自动锁定 (1-1.5 天)

### Q: 如何处理编译错误?
**A**: 
1. 检查 Cargo.toml 中的版本
2. 运行 `cargo update`
3. 检查文档中的依赖列表

### Q: 如何测试新功能?
**A**: 针对每个功能，文档都提供了详细的测试清单。按清单执行测试。

### Q: 如何调试?
**A**: 
- 后端：使用 `println!` 或 `dbg!` macro
- 前端：使用浏览器 DevTools
- 使用 VS Code 的调试器

---

## 📚 更新历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-15 | 初始发布，7个功能设计文档 |

---

**最后更新**: 2026-02-15 (UTC)
**作者**: DevVault 开发团队
**许可**: MIT
