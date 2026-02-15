# DevVault 开发路线图

## 📊 项目现状

**当前版本**: 0.1.0 (MVP - P0 功能完成)  
**完成度**: P0 100% ✓ | P1-P2 设计完成 | 开发中  
**Git 提交**: a6b6eb6  
**最后更新**: 2026-02-15  

---

## 🎯 优先级概览

### ✅ P0 - 已完成 (核心MVP)
```
密码CRUD ✓        | 搜索/筛选 ✓     | Smart Copy ✓
项目管理 ✓        | 主密码验证 ✓    | 隐身模式基础 ✓
Favicon缩略 ✓     | 数据加密 ✓      | 分类标签 ✓
```

### 🚀 P1-P2 - 优先实现 (共7个功能)

| # | 功能 | 难度 | 时间 | 优先级 | 工作量 | 状态 |
|---|------|------|------|--------|--------|------|
| 1 | Chrome导入 | ⭐⭐ | 3-4d | P1 | 高 | 📋 设计 |
| 2 | 剪贴板修复 | ⭐ | 30m | P1 | 低 | 📋 设计 |
| 3 | 冲突处理 | ⭐⭐ | 1-2d | P1 | 中 | 📋 设计 |
| 4 | 自动锁定 | ⭐⭐ | 1-1.5d | P1 | 中 | 📋 设计 |
| 5 | 隐身模式 | ⭐⭐ | 6-8h | P2 | 中 | 📋 设计 |
| 6 | 统计面板 | ⭐⭐ | 1.5d | P2 | 中 | 📋 设计 |
| 7 | 主题自定义 | ⭐⭐ | 8-11h | P2 | 中 | 📋 设计 |

### 🚀 P3 - 凭证管理扩展 (新增功能)

| # | 功能 | 难度 | 时间 | 优先级 | 工作量 | 状态 |
|---|------|------|------|--------|--------|------|
| 8 | 服务器&数据库凭证管理 | ⭐⭐⭐ | 5-6d | P3 | 极高 | 📋 设计 |

**功能描述**: 扩展凭证系统支持服务器、数据库、云服务等多种类型
**包含特性**:
- 🖥️ 服务器凭证 (云服务商、SSH、运维)
- 🗄️ 数据库凭证 (MySQL、PostgreSQL、MongoDB 等)
- 🔗 其他服务凭证 (Redis、MQ、ELK 等)
- 📝 完整的说明和运维信息
- 🏢 项目和环境分类

**设计文档**:
- [`OVERVIEW_P3_CREDENTIALS.md`](OVERVIEW_P3_CREDENTIALS.md) - 完整概览
- [`FEATURE_ANALYSIS_SERVER_CREDENTIALS.md`](FEATURE_ANALYSIS_SERVER_CREDENTIALS.md) - 详细分析
- [`IMPLEMENTATION_PLAN_SERVER_CREDENTIALS.md`](IMPLEMENTATION_PLAN_SERVER_CREDENTIALS.md) - 实现计划
- [`QUICK_DECISION_GUIDE.md`](QUICK_DECISION_GUIDE.md) - 快速决策

**工作量**: 40-50 小时 | **预计时间**: 1 周 (全职) 或 2-3 周 (兼职)

---

## 📚 详细功能设计文档

### 必须实现的功能清单 (优先顺序)

### 1. 🔴 [Chrome 密码导入](CHROME_IMPORT.md) 
**优先级**: 最高 | **复杂度**: ⭐⭐ | **时间**: 3-4天 | **工作量**: 高

从 Chrome 浏览器导入保存的密码。

🎯 **关键功能**:
- 自动检测 Chrome 数据库位置 (Windows/Mac/Linux)
- SQLite 数据库读取和解密
- 密码列表预览
- 单键导入

📋 **文件修改**:
- `src-tauri/src/commands.rs` - 添加 `read_chrome_passwords` 命令
- `src/components/ImportDialog.tsx` - 导入前端UI
- `src/lib/tauri-api.ts` - 新增 API 调用

👉 **详细设计**: 请查看 [CHROME_IMPORT.md](CHROME_IMPORT.md)

---

### 2. 🔴 [剪贴板监听器修复](CLIPBOARD_FIX.md)
**优先级**: 高 | **复杂度**: ⭐ | **时间**: 30分钟 | **工作量**: 低

自动检测剪贴板内容并提示导入密码。

🎯 **关键功能**:
- 实时监听剪贴板变化
- 敏感信息自动检测
- ItemModal 自动填充

📋 **文件修改**:
- `src/hooks/useClipboardMonitor.ts` - 新建 hook
- `src/components/ItemModal.tsx` - 集成监听器

👉 **详细设计**: 请查看 [CLIPBOARD_FIX.md](CLIPBOARD_FIX.md)

---

### 3. 🔴 [导入冲突处理](CONFLICT_HANDLING.md)
**优先级**: 高 | **复杂度**: ⭐⭐ | **时间**: 1-2天 | **工作量**: 中

智能处理导入时的重复项、部分匹配项等冲突。

🎯 **关键功能**:
- 冲突检测 (完全匹配、部分匹配、相似项)
- 用户选择处理策略 (跳过/替换/创建新项/合并)
- 导入统计报告

📋 **文件修改**:
- `src-tauri/src/commands.rs` - 冲突分析和解决命令
- `src/components/ImportConflictScreen.tsx` - 冲突处理UI
- `src/components/ImportDialog.tsx` - 集成冲突流程

👉 **详细设计**: 请查看 [CONFLICT_HANDLING.md](CONFLICT_HANDLING.md)

---

### 4. 🔴 [智能自动锁定](SMART_AUTOLOCK.md)
**优先级**: 高 | **复杂度**: ⭐⭐ | **时间**: 1-1.5天 | **工作量**: 中

应用最小化、空闲超时、系统唤醒时自动锁定。

🎯 **关键功能**:
- 可配置的锁定策略
- 空闲超时自动锁定 (1-60分钟)
- 最小化立即锁定
- 系统休眠/唤醒检测
- 敏感数据清除

📋 **文件修改**:
- `src-tauri/src/config.rs` - 配置管理系统
- `src-tauri/src/commands.rs` - 锁定相关命令
- `src/hooks/useAutoLock.ts` - 事件监听 hook
- `src/contexts/AppContext.tsx` - 添加 AUTO_LOCK 处理
- `src/components/SettingsPanel.tsx` - 设置UI

👉 **详细设计**: 请查看 [SMART_AUTOLOCK.md](SMART_AUTOLOCK.md)

---

### 5. 🟡 [隐身模式选项](STEALTH_MODES.md)
**优先级**: 中 | **复杂度**: ⭐⭐ | **时间**: 6-8小时 | **工作量**: 中

6种隐身模式：禁用、标准、屏幕锁定、工作场所、演示、访客。

🎯 **关键功能**:
- 模式切换 (6种预设)
- 按模式条件渲染 (隐藏/模糊/虚拟数据)
- 访问控制 (读写权限变更)
- 屏幕截图禁用

📋 **文件修改**:
- `src/hooks/useStealth.ts` - 模式管理 hook
- `src/components/StealthModePanel.tsx` - 模式选择UI
- `src/components/VaultList.tsx` - 应用模式渲染
- `src/components/ItemModal.tsx` - 应用模式权限

👉 **详细设计**: 请查看 [STEALTH_MODES.md](STEALTH_MODES.md)

---

### 6. 🟡 [数据统计面板](STATS_PANEL.md)
**优先级**: 中 | **复杂度**: ⭐⭐ | **时间**: 1.5天 | **工作量**: 中

安全指标、分类分布、活动日志、密码强度分析。

🎯 **关键功能**:
- KPI 卡片 (总项数、项目数、弱密码、重复密码)
- 可视化图表 (饼图、柱状图)
- 实时活动日志
- 导出报告 (PDF/CSV)

📋 **文件修改**:
- `src-tauri/src/commands.rs` - 统计收集命令
- 数据库：新增 `activity_log` 表
- `src/components/StatsDashboard.tsx` - 仪表板UI
- `package.json` - 添加 recharts 依赖

👉 **详细设计**: 请查看 [STATS_PANEL.md](STATS_PANEL.md)

---

### 7. 🟡 [主题自定义](THEME_CUSTOMIZATION.md)
**优先级**: 中 | **复杂度**: ⭐⭐ | **时间**: 8-11小时 | **工作量**: 中

深色模式、高对比度、自定义调色板、字体缩放。

🎯 **关键功能**:
- 主题模式 (浅色/深色/自动)
- 5个预设主题 (Default/Nord/Dracula/OneDark/Solarized)
- 完全自定义配置
- WCAG AAA 无障碍支持
- 字体大小缩放

📋 **文件修改**:
- `src-tauri/src/commands.rs` - 主题配置命令
- `src/contexts/ThemeContext.tsx` - 主题管理 context
- `src/components/ThemeSettingsPanel.tsx` - 设置UI
- `src/styles/globals.css` - CSS 变量系统

👉 **详细设计**: 请查看 [THEME_CUSTOMIZATION.md](THEME_CUSTOMIZATION.md)

---

## ⏰ 建议的 3 周开发时间线

```
┌─────────────────────────────────────────────────────┐
│                      WEEK 1                         │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Day 1-2  │ Day 2-3  │ Day 4    │ Day 5    │ Weekend │
│ Chrome   │Chrome(续)│剪贴板    │ 冲突处理  │ 测试    │
│导入-后端 │导入-前端 │修复      │ (1.5 day)│ 集成    │
│(2d)      │隐身模式  │(0.5d)   │          │         │
│          │开始(2d)  │          │          │         │
└──────────┴──────────┴──────────┴──────────┴─────────┘

┌─────────────────────────────────────────────────────┐
│                      WEEK 2                         │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Day 1-2  │ Day 3-4  │ Day 5    │  Buffer  │ Weekend │
│自动锁定  │统计面板  │主题自定义│ 功能测试 │ Code    │
## 📅 总体时间线

```
WEEK 1-3: P1-P2 功能实现 (7个功能)
├─ Week 1: Chrome导入 + 剪贴板修复 + 冲突处理
├─ Week 2: 自动锁定 + 隐身模式 + 统计面板
└─ Week 3: 主题自定义 + 集成测试 + v0.2.0 发布

        ↓

WEEK 4-5: P3 功能实现 (凭证系统扩展)
├─ Phase 1 (2天): 数据库架构 + 基础 API
├─ Phase 2 (2-3天): 服务器管理 UI + 功能
├─ Phase 3 (1-2天): 数据库管理
├─ Phase 4 (1天): 其他服务
└─ Phase 5 (1-2天): 优化 + v0.3.0 发布

WEEK 6+: P4 及以后的功能 (未来规划)
```

---

## 🔄 并行开发策略

### Phase 1: 并行快速功能 (Week 1, Day 4-5)
- 🧵 线程 A: 完成 Chrome 导入 (后端 + 前端)
- 🧵 线程 B: 实现剪贴板修复 + 开始隐身模式

### Phase 2: 中等功能 (Week 2)
- 🧵 线程 A: 自动锁定 + 统计面板
- 🧵 线程 B: 主题自定义

### Phase 3: 集成和优化 (Week 3)
- 统一集成测试
- 性能优化
- 发布准备

---

## 📌 关键依赖和检查点

### 后端依赖
```
Tauri 1.5 ✓
rusqlite 0.29 ✓
clipboard-win 5.4 ✓
dirs 5.0
serde_json 1.0
actix-rt (可选，用于异步任务)
```

### 前端依赖
```
React 18 ✓
TypeScript ✓
Tailwind CSS ✓
Lucide React ✓
recharts (新增，用于图表)
@tauri-apps/api ✓
```

### 必要升级
```diff
+ recharts: "^2.10.0"  (用于 STATS_PANEL)
+ 可选: zod 验证库
```

---

## 💾 数据库变更

### 新增表
```sql
-- 活动日志表 (STATS_PANEL 需要)
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_title TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (item_id) REFERENCES vault_items(id)
);
```

### 新增字段
```sql
-- vault_items 表新增字段 (可选)
ALTER TABLE vault_items 
  ADD COLUMN last_accessed INTEGER;  -- 上次访问时间戳
```

---

## 🧪 验收标准

### Chrome 导入
- [ ] 能成功读取 Chrome 密码
- [ ] UI 显示导入预览
- [ ] 冲突检测工作
- [ ] 导入后数据显示在列表中

### 剪贴板修复
- [ ] 复制密码时自动检测
- [ ] ItemModal 自动填充
- [ ] 显示自动填充提示

### 冲突处理
- [ ] 检测所有冲突类型
- [ ] 用户可以选择处理方式
- [ ] 导入统计准确

### 自动锁定
- [ ] 空闲超时后锁定
- [ ] 最小化立即锁定
- [ ] 设置保存生效

### 隐身模式
- [ ] 切换模式后 UI 正确变化
- [ ] 所有6种模式都有效
- [ ] 权限控制生效

### 统计面板
- [ ] 图表显示准确
- [ ] 活动日志记录完整
- [ ] 导出功能可用

### 主题自定义
- [ ] 所有预设主题可加载
- [ ] 自定义颜色保存生效
- [ ] 无障碍选项有效
- [ ] 颜色对比度符合标准

---

## 📚 相关文档导航

### 总体
- [README.md](README.md) - 开发文档索引（强烈推荐首先查看）
- [DEVELOPMENT.md](../../DEVELOPMENT.md) - 项目开发指南

### 详细设计文档
1. [CHROME_IMPORT.md](CHROME_IMPORT.md) - Chrome 导入详细设计
2. [CLIPBOARD_FIX.md](CLIPBOARD_FIX.md) - 剪贴板修复详细设计
3. [CONFLICT_HANDLING.md](CONFLICT_HANDLING.md) - 冲突处理详细设计
4. [SMART_AUTOLOCK.md](SMART_AUTOLOCK.md) - 自动锁定详细设计
5. [STEALTH_MODES.md](STEALTH_MODES.md) - 隐身模式详细设计
6. [STATS_PANEL.md](STATS_PANEL.md) - 统计面板详细设计
7. [THEME_CUSTOMIZATION.md](THEME_CUSTOMIZATION.md) - 主题自定义详细设计

### 分析和参考
- [ANALYSIS_PASSWORD_FLOW.md](ANALYSIS_PASSWORD_FLOW.md) - 密码流程分析
- [FEATURES_CHECKLIST.md](FEATURES_CHECKLIST.md) - P0 功能检查清单

---

## 🚀 快速开始

### 1. 了解项目架构
```bash
# 阅读这些文件（按顺序）
1. README.md (文档索引)
2. ROADMAP.md (本文件)
3. 选择一个功能 → 对应的详细设计文档
```

### 2. 选择起点功能

**建议顺序**（从简单到难）:
1. ⭐ 剪贴板修复 (30 分钟)
2. ⭐⭐ 隐身模式 (6-8 小时)
3. ⭐⭐ 主题自定义 (8-11 小时)
4. ⭐⭐ Chrome 导入 (3-4 天)
5. ⭐⭐ 冲突处理 (1-2 天)
6. ⭐⭐ 统计面板 (1.5 天)
7. ⭐⭐ 自动锁定 (1-1.5 天)

### 3. 实现流程

```bash
# 选择一个功能后
1. 打开对应的详细设计文档
2. 按该文档的实现步骤进行
3. 每个文档都包含：
   - 完整的代码示例
   - 测试清单
   - 常见问题解答

# 示例：实现剪贴板监听器
$ code docs/dev/CLIPBOARD_FIX.md
# 按文档创建 useClipboardMonitor.ts
# 按文档修改 ItemModal.tsx
# 本地测试
$ npm run dev:tauri
```

---

## 🤝 开发协作

### 分支命名规则
```
feature/{feature-name}     # 新功能
enhancement/{improve-name} # 优化
bugfix/{bug-name}         # 修复
docs/{doc-name}           # 文档
```

### Commit 消息格式
```
feat: 实现 Chrome 导入功能
fix: 修复剪贴板监听器内存泄漏
docs: 完成主题自定义文档
test: 添加统计面板测试
refactor: 优化自动锁定性能
```

### Pull Request 检查清单
- [ ] 代码通过 lint (`npm run lint`)
- [ ] 编译无错误 (`cargo check`)
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] ROADMAP.md 已标记完成

---

## 📊 进度跟踪

### 当前状态 (2026-02-15)
```
✅ P0 功能完整实现
📋 7个 P1-P2 功能详细设计完成
🚀 等待开发启动
```

### 完成标记格式
```markdown
- [x] 功能名 (n days) ✓ 日期
- [ ] 功能名 (n days) - 进行中
```

---

## 🔗 外部资源

- [Tauri 官方文档](https://tauri.app/)
- [React 官方文档](https://react.dev/)
- [Rust 圣经](https://doc.rust-lang.org/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

---

**最后更新**: 2026-02-15  
**维护**: DevVault 开发团队  
**许可**: MIT

**优先级**: 高  
**复杂度**: 低 (30分钟)  
**现状**: 已部分实现，但使用了错误的 API

**问题代码**:
```tsx
// ItemModal.tsx 中的 checkClipboard()
if (navigator.clipboard) {  // ← 浏览器 API，Tauri 中不可用
  const text = await navigator.clipboard.readText();
}
```

**正确方案**:
```tsx
import { readText } from '@tauri-apps/api/clipboard';

const checkClipboard = async () => {
  try {
    const text = await readText();  // ← Tauri API
    if (text && text.length > 20 && /[A-Za-z0-9+_\-=]/.test(text)) {
      // 检测到可能的 API Key
      if (window.confirm('检测到剪贴板中可能有 API Key，是否自动填入？')) {
        setFormData(prev => ({ ...prev, secret: text }));
      }
    }
  } catch (error) {
    console.debug('Clipboard check failed:', error);
  }
};
```

**修改文件**:
- `src/components/ItemModal.tsx` - 修复 checkClipboard 函数

---

### 3. 🟡 导入冲突处理 (P1 - 与导入功能配套)

**优先级**: 高  
**复杂度**: 中 (1-2天)  
**PRD要求**:
- 检测重复项（基于 URL + Key 长度）
- 显示导入冲突预览
- 用户选择：覆盖/跳过/重命名后导入

**实现逻辑**:
```tsx
// 冲突检测算法
const detectDuplicates = (importItems: VaultItem[], existingItems: VaultItem[]) => {
  return importItems.map(newItem => {
    const duplicate = existingItems.find(existing =>
      existing.url === newItem.url &&
      existing.secret_encrypted.length === newItem.secret_encrypted.length
    );
    return { item: newItem, isDuplicate: !!duplicate, existingItem: duplicate };
  });
};
```

**前端组件**:
- ConflictDialog 组件
  - 显示冲突项列表
  - 为每个冲突项提供选择按钮（覆盖/跳过/重命名）

**相关文件**:
- `src/components/ConflictDialog.tsx` - 新建
- `src/lib/tauri-api.ts` - 可能需要后端支持

---

### 4. 🟡 智能锁定 (P1 - 安全性增强)

**优先级**: 中  
**复杂度**: 中 (1-2天)  
**PRD要求**:
- 5 分钟无操作自动锁定
- 窗口最小化立即锁定
- 系统休眠/锁屏立即锁定

**实现方案**:

**前端（React）**:
```tsx
// AutoLock 逻辑
useEffect(() => {
  let idleTimer: NodeJS.Timeout;
  let inactivityTimer: NodeJS.Timeout;
  
  const resetTimer = () => {
    clearTimeout(idleTimer);
    clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(() => {
      dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
    }, 5 * 60 * 1000); // 5 分钟
  };
  
  // 监听用户活动
  ['mousedown', 'keydown', 'scroll'].forEach(event => {
    window.addEventListener(event, resetTimer);
  });
  
  // 监听窗口最小化
  window.addEventListener('focus', resetTimer);
  window.addEventListener('blur', handleWindowBlur); // 最小化时锁定
  
  return () => {
    ['mousedown', 'keydown', 'scroll'].forEach(event => {
      window.removeEventListener(event, resetTimer);
    });
  };
}, []);

const handleWindowBlur = () => {
  dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
};
```

**后端（Tauri）**:
- 监听系统休眠/锁屏事件（使用 `tauri::globalshortcut` 或平台特定 API）

**相关文件**:
- `src/hooks/useAutoLock.ts` - 新建 hook
- `src/App.tsx` - 集成 useAutoLock
- `src-tauri/src/main.rs` - 可选：添加系统事件监听

---

### 5. 🟡 隐身模式选项 (P1 - 体验优化)

**优先级**: 中  
**复杂度**: 低 (4小时)  
**现状**: 已实现完全隐藏，需要添加模糊效果选项

**PRD要求**:
- 选项1: 完全隐藏（当前实现）- `*`
- 选项2: 模糊效果 - CSS 模糊滤镜

**实现**:
```tsx
// Toolbar.tsx 中添加隐身模式菜单
<select value={stealthMode} onChange={handleStealthModeChange}>
  <option value="off">关闭</option>
  <option value="hide">完全隐藏 (***)</option>
  <option value="blur">模糊显示</option>
</select>

// displayText 函数升级
const displayText = (text: string, stealthMode: 'off' | 'hide' | 'blur') => {
  if (stealthMode === 'off') return text;
  if (stealthMode === 'hide') return '*'.repeat(Math.min(text.length, 8));
  if (stealthMode === 'blur') {
    return (
      <span style={{ filter: 'blur(4px)', userSelect: 'none' }}>
        {text}
      </span>
    );
  }
};
```

**修改文件**:
- `src/contexts/AppContext.tsx` - 添加 stealthMode 状态选项
- `src/components/Toolbar.tsx` - 添加菜单
- `src/components/VaultList.tsx` - 升级 displayText 函数

---

### 6. 📊 数据统计面板 (P2 - 用户体验)

**优先级**: 中-低  
**复杂度**: 低 (4小时)  
**需要统计**:
- 凭证总数
- 项目数量
- 上次使用时间
- 安全指标（弱密码比例等）

**实现**:
```tsx
// Dashboard.tsx 新建
interface Stats {
  totalItems: number;
  totalProjects: number;
  categoryCounts: Record<string, number>;
  lastModified: string;
}

const StatsPanel = () => {
  const { state } = useApp();
  const stats: Stats = {
    totalItems: state.vaultItems.length,
    totalProjects: state.projects.length,
    categoryCounts: state.vaultItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}),
    lastModified: new Date().toLocaleDateString(),
  };
  
  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {/* 统计卡片 */}
    </div>
  );
};
```

**相关文件**:
- `src/components/StatsPanel.tsx` - 新建
- `src/components/MainLayout.tsx` - 集成到顶部或侧边栏

---

### 7. 🎨 主题自定义 (P2 - 社区特性)

**优先级**: 低  
**复杂度**: 中 (8小时)  
**需要支持**:
- 内置主题（亮色/深色/自定义）
- 颜色方案编辑器
- 主题持久化

**实现方案**:
```tsx
// ThemeContext.tsx 新建
interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    error: string;
    success: string;
    warning: string;
  };
}

// 在 tailwind.config.js 中使用 CSS 变量
module.exports = {
  content: [...],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        // ...
      },
    },
  },
};
```

**修改文件**:
- `src/contexts/ThemeContext.tsx` - 新建
- `src/styles/globals.css` - 添加 CSS 变量
- `tailwind.config.js` - 配置变量引用
- `src/components/Settings.tsx` - 主题选择 UI

---

## 开发工作流

### 分支策略
```
main (生产)
├── development (开发主分支)
│   ├── feature/chrome-import (功能分支)
│   ├── feature/clipboard-fix
│   └── feature/conflict-handling
```

### 提交信息规范
```
类型: 简短描述

详细说明（可选）

Closes #123   # 关联 Issue

类型列表:
- feat: 新功能
- fix: 修复
- refactor: 重构
- docs: 文档
- test: 测试
- chore: 构建工具、依赖等
```

### 测试清单
每个功能完成后，必须执行：
```
[ ] npm run lint - 代码风格检查
[ ] npm run type-check - TypeScript 类型检查
[ ] npm run build - 构建测试
[ ] npm run tauri:build - Tauri 构建测试
[ ] 手动功能测试在 UI 中
```

---

## 文件结构参考

```
docs/dev/
├── ROADMAP.md (本文件)              # 功能路线图
├── CHROME_IMPORT.md                 # Chrome 导入详细设计
├── CLIPBOARD_INTEGRATION.md         # 剪贴板集成指南
├── CONFLICT_HANDLING.md             # 冲突处理逻辑
├── AUTO_LOCK.md                     # 智能锁定实现
├── STEALTH_MODES.md                 # 隐身模式选项
├── STATS_PANEL.md                   # 数据统计设计
├── THEME_CUSTOMIZATION.md           # 主题自定义指南
└── ARCHITECTURE.md                  # 整体架构文档
```

---

## 下一步行动

1. **第一周**: 实现 Chrome 导入 + 剪贴板修复
2. **第二周**: 导入冲突处理 + 智能锁定
3. **第三周**: 隐身模式选项 + 数据统计面板
4. **第四周+**: 主题自定义、其他 Q&A

---

## 已知问题 & TODO

- [ ] 密码流程竞态条件 (见 ANALYSIS_PASSWORD_FLOW.md)
- [ ] 剪贴板 API 修复 (即将开始)
- [ ] Chrome 数据库加密解密 (需要研究)
- [ ] 多平台支持测试 (Windows/Mac/Linux)

---

**最后更新**: 2026-02-15  
**维护者**: DevVault Team
