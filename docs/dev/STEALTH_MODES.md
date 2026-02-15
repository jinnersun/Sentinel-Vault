# 隐身模式选项详细设计

## 问题描述

不同用户有不同的隐私需求：
1. **家庭共享设备** - 需要隐藏敏感账户
2. **工作环境** - 需要屏幕锁定模式
3. **展示演示** - 需要虚拟数据或禁用截图
4. **多用户设备** - 需要来宾模式

**需求**：提供灵活的隐身模式选项，满足不同场景。

---

## 功能设计

### 隐身模式类型

#### 1. 标准隐身模式（已有）
```
- 模糊存储的密码字符
- 不显示用户名
- 不显示 URL
```

#### 2. 屏幕锁定模式（新）
```
- 禁用截图（Tauri）
- 禁用屏幕录制
- 禁用 DevTools
- 禁用可视化检查
- 清除任务栏预览
```

#### 3. 工作场所模式（新）
```
- 隐藏所有密码（点击显示）
- 模糊图标
- 隐藏 URL 目录
- 显示只读提示
- 禁用复制历史
```

#### 4. 演示模式（新）
```
- 显示虚拟数据而不是真实数据
- 禁用复制操作
- 禁用编辑/删除
- 显示"演示"标记
- 自动轮换数据
```

#### 5. 访客模式（新）
```
- 只读访问
- 有限的项目查看
- 禁用导入/导出
- 自动锁定（1分钟）
- 受限的密码验证
```

---

## 架构设计

### 配置模型

```typescript
interface StealtModeConfig {
  // 全局配置
  enabled: boolean;
  
  // 模式选择
  mode: 'disabled' | 'standard' | 'locked' | 'workplace' | 'demo' | 'guest';
  
  // 功能控制
  features: {
    hidePasswords: boolean;
    hideUsernames: boolean;
    hideUrls: boolean;
    hideIcons: boolean;
    disableScreenshot: boolean;
    disableDevTools: boolean;
    disableRecording: boolean;
    readOnlyMode: boolean;
    disableCopy: boolean;
    disableExport: boolean;
    demoData: boolean;
  };
  
  // 定时器
  sessionTimeout?: number;  // 分钟
  autoLockInterval?: number;
}
```

---

## 后端实现

### 1. 隐身模式命令

**src-tauri/src/commands.rs** 添加:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StealthMode {
    Disabled,
    Standard,
    Locked,
    Workplace,
    Demo,
    Guest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthConfig {
    pub enabled: bool,
    pub mode: StealthMode,
    pub disable_screenshot: bool,
    pub disable_devtools: bool,
    pub hide_url_path: bool,
    pub read_only_mode: bool,
    pub session_timeout_minutes: u32,
}

#[command]
pub async fn get_stealth_config() -> Result<StealthConfig, String> {
    // 从配置文件读取
    let config = StealthConfig {
        enabled: false,
        mode: StealthMode::Disabled,
        disable_screenshot: false,
        disable_devtools: false,
        hide_url_path: false,
        read_only_mode: false,
        session_timeout_minutes: 60,
    };
    Ok(config)
}

#[command]
pub async fn set_stealth_config(config: StealthConfig, app: tauri::AppHandle) -> Result<(), String> {
    // 应用配置
    if config.disable_screenshot {
        disable_screenshot_tauri(&app)?;
    }
    
    if config.disable_devtools {
        disable_devtools_tauri(&app)?;
    }
    
    // 保存到磁盘
    Ok(())
}

#[command]
pub async fn enter_demo_mode() -> Result<Vec<VaultItem>, String> {
    // 返回示例数据
    vec![
        VaultItem {
            id: "demo_1".to_string(),
            title: "Gmail Demo Account".to_string(),
            secret_encrypted: "••••••••••••••••".to_string(),
            url: "https://accounts.google.com".to_string(),
            username: "demo.user@gmail.com".to_string(),
            category: "Email".to_string(),
            color: "#f97316".to_string(),
            ..Default::default()
        },
        // 更多示例...
    ]
    // 这些是加密的虚拟数据，实际不是真实密码
}

// 禁用截图（Windows）
#[cfg(target_os = "windows")]
fn disable_screenshot_tauri(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_window("main") {
        // 使用 Windows API 禁用截图
        // 需要调用 Win32 API
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

// 禁用 DevTools
fn disable_devtools_tauri(app: &tauri::AppHandle) -> Result<(), String> {
    // Tauri 发布版本默认禁用 DevTools
    // 开发版本可以通过环境变量控制
    Ok(())
}
```

### 2. 访问控制中间件

```rust
#[command]
pub async fn validate_operation(
    operation: String,
    config: tauri::State<'_, StealthConfig>,
) -> Result<bool, String> {
    match operation.as_str() {
        "copy" if config.read_only_mode => Ok(false),
        "export" if config.read_only_mode => Ok(false),
        "delete" if config.read_only_mode => Ok(false),
        "edit" if config.read_only_mode => Ok(false),
        _ => Ok(true),
    }
}
```

---

## 前端实现

### 1. 隐身模式 Hook

**src/hooks/useStealth.ts** (新文件):
```typescript
import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import api from '../lib/tauri-api';

export type StealthMode = 'disabled' | 'standard' | 'locked' | 'workplace' | 'demo' | 'guest';

interface StealthConfig {
  enabled: boolean;
  mode: StealthMode;
  disable_screenshot: boolean;
  disable_devtools: boolean;
  hide_url_path: boolean;
  read_only_mode: boolean;
  session_timeout_minutes: number;
}

export function useStealth() {
  const { state } = useContext(AppContext);
  const [config, setConfig] = useState<StealthConfig>({
    enabled: state.stealthMode?.enabled ?? false,
    mode: state.stealthMode?.mode ?? 'disabled',
    disable_screenshot: false,
    disable_devtools: false,
    hide_url_path: false,
    read_only_mode: false,
    session_timeout_minutes: 60,
  });

  const [demoData, setDemoData] = useState<any[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await api.getStealthConfig?.();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load stealth config:', error);
    }
  };

  const setMode = async (mode: StealthMode) => {
    const newConfig = { ...config, mode };
    
    try {
      await api.setStealthConfig?.(newConfig);
      setConfig(newConfig);

      if (mode === 'demo') {
        const demo = await api.enterDemoMode?.();
        setDemoData(demo || []);
      }
    } catch (error) {
      console.error('Failed to set stealth mode:', error);
      throw error;
    }
  };

  const shouldHidePassword = config.mode !== 'disabled';
  const shouldHideUsername = config.mode === 'workplace' || config.mode === 'demo';
  const shouldHideUrl = config.mode === 'workplace';
  const shouldDisableCopy = config.mode === 'demo' || config.mode === 'guest';
  const isReadOnly = config.mode === 'demo' || config.mode === 'guest' || config.read_only_mode;

  return {
    config,
    setMode,
    setConfig,
    demoData,
    shouldHidePassword,
    shouldHideUsername,
    shouldHideUrl,
    shouldDisableCopy,
    isReadOnly,
  };
}
```

### 2. 隐身模式设置面板

**src/components/StealthModePanel.tsx** (新文件):
```tsx
import React from 'react';
import { Shield, Lock, Eye, Zap } from 'lucide-react';
import { useStealth } from '../hooks/useStealth';

export default function StealthModePanel() {
  const { config, setMode } = useStealth();

  const modes = [
    {
      id: 'disabled',
      name: 'Off',
      icon: '❌',
      description: 'Normal mode - all data visible',
      color: 'text-text2',
    },
    {
      id: 'standard',
      name: 'Standard',
      icon: '🔒',
      description: 'Hide passwords, blur sensitive data',
      color: 'text-warning',
    },
    {
      id: 'locked',
      name: 'Locked',
      icon: '🔐',
      description: 'No screenshots, disable DevTools',
      color: 'text-error',
    },
    {
      id: 'workplace',
      name: 'Workplace',
      icon: '💼',
      description: 'Hide URLs and usernames, read-only',
      color: 'text-info',
    },
    {
      id: 'demo',
      name: 'Demo',
      icon: '🎬',
      description: 'Show demo data, disable copy/export',
      color: 'text-accent',
    },
    {
      id: 'guest',
      name: 'Guest',
      icon: '👤',
      description: 'Limited read-only access, auto-lock',
      color: 'text-text2',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="flex items-center text-lg font-bold text-text mb-2">
          <Shield className="w-5 h-5 mr-2" />
          Stealth Mode
        </h2>
        <p className="text-sm text-text2">
          Choose a stealth mode to match your security needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id as any)}
            className={`p-4 rounded-lg border-2 transition ${
              config.mode === mode.id
                ? 'border-accent bg-accent bg-opacity-10'
                : 'border-surface2 bg-surface hover:border-accent'
            }`}
          >
            <div className="text-2xl mb-2">{mode.icon}</div>
            <p className="font-semibold text-text">{mode.name}</p>
            <p className="text-xs text-text2 mt-1">{mode.description}</p>
          </button>
        ))}
      </div>

      {/* 选中模式的详情 */}
      <div className="p-4 bg-surface rounded-lg border border-surface2">
        <h3 className="font-semibold text-text mb-3">
          Current Mode Details
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start space-x-2">
            <span className="text-accent">▪</span>
            <span className="text-text2">
              {getModeDescription(config.mode)}
            </span>
          </div>
        </div>
      </div>

      {/* 演示模式警告 */}
      {config.mode === 'demo' && (
        <div className="p-3 bg-warning bg-opacity-20 border border-warning rounded text-sm text-warning">
          ⚠️ Demo mode is active. All displayed data is fictional for demonstration purposes.
        </div>
      )}

      {/* 访客模式警告 */}
      {config.mode === 'guest' && (
        <div className="p-3 bg-info bg-opacity-20 border border-info rounded text-sm text-info">
          ℹ️ Guest mode enabled. Session will auto-lock after {config.session_timeout_minutes} minutes.
        </div>
      )}
    </div>
  );
}

function getModeDescription(mode: string): string {
  const descriptions: Record<string, string> = {
    disabled: 'No stealth protection. All data is visible.',
    standard: 'Passwords are hidden. Usernames and URLs remain visible.',
    locked: 'Maximum protection. Screenshots and DevTools are disabled.',
    workplace: 'URLs and usernames are hidden. Read-only mode enabled.',
    demo: 'Displays fictional demo data. Copy and export disabled.',
    guest: 'Limited read-only access. Auto-locks after timeout.',
  };
  return descriptions[mode] || '';
}
```

### 3. 在 VaultList 中应用隐身模式

**src/components/VaultList.tsx** 修改:
```tsx
import { useStealth } from '../hooks/useStealth';

export default function VaultList() {
  const { shouldHidePassword, shouldHideUsername, shouldHideUrl, isReadOnly, shouldDisableCopy } = useStealth();
  const { vaultItems, selectedItem, dispatch } = useApp();

  return (
    <div className="space-y-2">
      {vaultItems.map((item) => (
        <div key={item.id} className="p-3 rounded bg-surface hover:bg-surface2 cursor-pointer">
          {/* 用户名字段 */}
          <div className="font-medium text-text">
            {shouldHideUsername ? '••••••••' : item.title}
          </div>

          {/* URL 字段 */}
          {!shouldHideUrl && (
            <div className="text-sm text-text2 truncate">
              {item.url}
            </div>
          )}

          {/* 密码显示 */}
          <div className="text-sm mt-1">
            {shouldHidePassword ? '••••••••••••••••' : item.secret_encrypted}
          </div>

          {/* 复制按钮 */}
          <div className="mt-2 flex space-x-2">
            <button
              onClick={() => api.copyToClipboard(item.secret_encrypted)}
              disabled={shouldDisableCopy}
              className={shouldDisableCopy ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {shouldDisableCopy ? '🔒 Copy' : '📋 Copy'}
            </button>

            {isReadOnly && (
              <span className="text-xs text-text2">Read-only</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4. 在 ItemModal 中应用

**src/components/ItemModal.tsx** 修改:
```tsx
import { useStealth } from '../hooks/useStealth';

export default function ItemModal() {
  const { isReadOnly } = useStealth();

  // 禁用删除/编辑按钮
  if (isReadOnly) {
    return (
      <div className="p-4 bg-info bg-opacity-20 border border-info rounded">
        Read-only mode: editing is disabled
      </div>
    );
  }

  return (
    // ... 正常的编辑表单
  );
}
```

---

## 用户体验流程

### 场景 1：家庭使用 - 标准隐身模式
```
1. 打开 DevVault
2. 点击设置 → 隐身模式
3. 选择"Standard"
4. 密码自动模糊 ✓
5. 用户名和 URL 仍然可见
```

### 场景 2：屏幕展示 - 演示模式
```
1. 打开 DevVault
2. 选择"Demo"模式
3. 看到虚拟数据（演示账户）
4. 复制按钮被禁用
5. 编辑/删除按钮被禁用
6. 显示"演示"标记 ✓
```

### 场景 3：工作环境 - 工作场所模式
```
1. 打开 DevVault
2. 选择"Workplace"模式
3. URL 被隐藏
4. 用户名被模糊
5. 所有编辑被禁用
6. 显示"只读"提示 ✓
```

---

## 安全考虑

### 屏幕捕获防护

```
# Windows (通过 Tauri 或 Win32 API)
禁用 PrintScreen 键
禁用 Alt+PrintScreen
禁用 Snipping Tool

# macOS
禁用 Cmd+Shift+3/4/5

# Linux
X11 扩展控制
```

### DevTools 禁用

```
# Tauri 配置
在 tauri.conf.json 中设置 devPath 和 build
发布版本自动禁用 DevTools
```

### 数据擦除

隐身模式启用时内存中的敏感数据处理：
- 不缓存真实密码
- 定期清除临时数据
- 禁用浏览器缓存

---

## 测试检单

### 模式切换测试
- [ ] 从 Disabled 切换到 Standard
- [ ] 从 Standard 切换到 Locked
- [ ] 从 Locked 切换回 Disabled
- [ ] 隐身模式设置持久化

### 功能测试

| 模式 | 密码 | 用户名 | URL | 复制 | 删除 |
|------|------|--------|-----|------|------|
| Disabled | 显示 | 显示 | 显示 | ✓ | ✓ |
| Standard | 隐藏 | 显示 | 显示 | ✓ | ✓ |
| Locked | 隐藏 | 显示 | 显示 | ✓ | ✓ |
| Workplace | 隐藏 | 隐藏 | 隐藏 | ✓ | ❌ |
| Demo | 虚拟 | 隐藏 | 隐藏 | ❌ | ❌ |
| Guest | 虚拟 | 隐藏 | 隐藏 | ❌ | ❌ |

### 安全测试
- [ ] 禁用屏幕截图（Locked 模式）
- [ ] 禁用 DevTools
- [ ] Demo 数据不是真实数据
- [ ] Read-only 模式真正只读

---

## 实现时间

- **后端**：3-4 小时
  - 隐身模式命令：1.5 小时
  - 访问控制：1 小时
  - 演示数据：1 小时

- **前端**：3-4 小时
  - useStealth hook：1 小时
  - UI 组件：2 小时
  - 集成：1 小时

**总计**：6-8 小时（不到 1 天）

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 5 个优先事项（P2）。

---

**最后更新**: 2026-02-15
**难度**: ⭐⭐ 中等（多条件渲染和访问控制）
**对用户的影响**: 高（支持多场景使用）
