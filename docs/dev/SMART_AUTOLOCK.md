# 智能自动锁定功能设计

## 问题描述

用户关心应用在后台运行时的安全性：
1. **应用最小化时** - 需要在重新使用前锁定
2. **长时间无操作** - 自动锁定防止未授权访问
3. **系统休眠唤醒** - 重新要求密码
4. **浏览器标签页切换** - 隐藏敏感数据

**需求**：实现灵活的自动锁定策略，提高安全性同时保持用户体验。

---

## 功能设计

### 锁定触发条件

```
应用事件
├─ 最小化事件
├─ 聚焦丧失事件
├─ 系统休眠/唤醒
├─ 空闲计时器（可配置）
└─ 标签页隐藏

↓ 所有条件 ↓

触发 AUTO_LOCK
    ↓
清除敏感数据
    ↓
显示 PasswordScreen
```

### 配置选项

用户可以在设置中配置：
| 选项 | 默认值 | 说明 |
|------|--------|------|
| 启用自动锁定 | ✓ | 全局开关 |
| 空闲超时 | 5 分钟 | 无操作锁定时间 |
| 最小化立即锁定 | ✓ | 应用最小化时锁定 |
| 标签切换锁定 | ✓ | 浏览器标签切换时锁定 |
| 休眠/唤醒锁定 | ✓ | 系统唤醒时锁定 |

---

## 后端实现

### 1. 配置结构

**src-tauri/src/config.rs** (新文件):
```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoLockConfig {
    pub enabled: bool,
    pub idle_timeout_minutes: u32,  // 5-60
    pub lock_on_minimize: bool,
    pub lock_on_tab_switch: bool,
    pub lock_on_sleep: bool,
}

impl Default for AutoLockConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            idle_timeout_minutes: 5,
            lock_on_minimize: true,
            lock_on_tab_switch: true,
            lock_on_sleep: true,
        }
    }
}

pub fn get_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("devvault")
        .join("config.json")
}

pub fn load_config() -> Result<AutoLockConfig, String> {
    let path = get_config_path();
    
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Invalid config format: {}", e))
    } else {
        Ok(AutoLockConfig::default())
    }
}

pub fn save_config(config: &AutoLockConfig) -> Result<(), String> {
    let path = get_config_path();
    fs::create_dir_all(path.parent().unwrap())
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {}", e))
}
```

### 2. 锁定管理命令

**src-tauri/src/commands.rs** 添加:
```rust
use crate::config::{AutoLockConfig, load_config, save_config};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// 全局状态追踪
pub struct LockState {
    pub last_activity: Instant,
    pub is_locked: bool,
    pub config: AutoLockConfig,
}

#[command]
pub async fn get_auto_lock_config() -> Result<AutoLockConfig, String> {
    load_config()
}

#[command]
pub async fn set_auto_lock_config(config: AutoLockConfig) -> Result<(), String> {
    // 验证值
    if config.idle_timeout_minutes < 1 || config.idle_timeout_minutes > 60 {
        return Err("Timeout must be 1-60 minutes".to_string());
    }
    
    save_config(&config)
}

#[command]
pub async fn lock_vault(app: tauri::AppHandle) -> Result<(), String> {
    // 清除应用状态
    if let Some(window) = app.get_window("main") {
        window.emit("vault-locked", ()).ok();
    }
    
    Ok(())
}

#[command]
pub async fn get_lock_status(state: tauri::State<'_, LockState>) -> Result<bool, String> {
    Ok(state.is_locked)
}

#[command]
pub async fn reset_activity_timer(state: tauri::State<'_, LockState>) -> Result<(), String> {
    // 重置活动计时器
    // 在 UI 交互时调用
    Ok(())
}
```

### 3. 事件监听

**src-tauri/src/main.rs** 修改:
```rust
use tauri::{
    Manager, SystemTray, SystemTrayMenu, SystemTrayEvent,
    WindowEvent, Window,
};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::thread;

mod config;
use config::{load_config, AutoLockConfig};

fn main() {
    let lock_state = Arc::new(Mutex::new(LockState {
        last_activity: Instant::now(),
        is_locked: false,
        config: load_config().unwrap_or_default(),
    }));

    let lock_state_clone = Arc::clone(&lock_state);

    tauri::Builder::default()
        .manage(lock_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let lock_state = lock_state_clone.clone();

            // ===== 启动自动锁定检查线程 =====
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(10));

                    if let Ok(state) = lock_state.lock() {
                        if !state.config.enabled || state.is_locked {
                            continue;
                        }

                        let idle_duration = Instant::now()
                            .duration_since(state.last_activity);
                        let timeout = Duration::from_secs(
                            state.config.idle_timeout_minutes as u64 * 60
                        );

                        if idle_duration > timeout {
                            // 触发锁定
                            if let Some(window) = app_handle.get_window("main") {
                                window.emit("auto-lock-trigger", {
                                    "reason": "idle_timeout"
                                }).ok();
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|event| {
            match event.event() {
                // 监听窗口最小化
                WindowEvent::Minimized => {
                    if let Ok(state) = lock_state.lock() {
                        if state.config.lock_on_minimize {
                            event.window().emit("auto-lock-trigger", {
                                "reason": "minimize"
                            }).ok();
                        }
                    }
                }

                // 监听焦点变化
                WindowEvent::Focused(focused) => {
                    if !*focused {
                        if let Ok(state) = lock_state.lock() {
                            if state.config.lock_on_tab_switch {
                                event.window().emit("auto-lock-trigger", {
                                    "reason": "focus_lost"
                                }).ok();
                            }
                        }
                    }
                }

                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub struct LockState {
    pub last_activity: Instant,
    pub is_locked: bool,
    pub config: AutoLockConfig,
}
```

---

## 前端实现

### 1. 自动锁定 Hook

**src/hooks/useAutoLock.ts** (新文件):
```typescript
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import api from '../lib/tauri-api';

interface AutoLockOptions {
  onLockTriggered?: (reason: string) => void;
  enabled?: boolean;
}

export function useAutoLock({
  onLockTriggered,
  enabled = true,
}: AutoLockOptions = {}) {
  const activityTimerRef = useRef<number | null>(null);

  // ===== 监听锁定触发事件 =====
  useEffect(() => {
    if (!enabled) return;

    const unlistenPromise = listen('auto-lock-trigger', (event: any) => {
      const reason = event.payload?.reason || 'unknown';
      onLockTriggered?.(reason);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [enabled, onLockTriggered]);

  // ===== 监听用户活动 =====
  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      // 重置活动计时器
      api.resetActivityTimer().catch(console.error);

      // 仅在必要时发送
      if (activityTimerRef.current !== null) {
        clearTimeout(activityTimerRef.current);
      }
    };

    const events = [
      'mousedown',
      'keydown',
      'click',
      'touchstart',
      'scroll',
    ];

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [enabled]);

  // ===== 监听系统休眠/唤醒 =====
  useEffect(() => {
    if (!enabled) return;

    // 监听系统休眠
    const handleSleep = async () => {
      onLockTriggered?.('system_sleep');
    };

    // 使用 Tauri 的系统事件（如果可用）
    // 或者检测长时间无活动
    const checkInterval = setInterval(async () => {
      const isLocked = await api.getLockStatus?.();
      if (!isLocked) {
        // 可以添加额外的检查逻辑
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [enabled, onLockTriggered]);
}
```

### 2. 在 AppContext 中集成

**src/contexts/AppContext.tsx** 修改:
```tsx
import { useAutoLock } from '../hooks/useAutoLock';

export default function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 集成自动锁定
  useAutoLock({
    onLockTriggered: (reason) => {
      console.log(`Vault auto-locked: ${reason}`);
      
      // 清除敏感数据
      dispatch({
        type: 'AUTO_LOCK',
        payload: { reason },
      });
    },
    enabled: true, // 可从设置读取
  });

  // AppContext reducer 中添加 AUTO_LOCK 处理
  // 在 reducer 中:
  case 'AUTO_LOCK':
    return {
      ...state,
      vaultItems: [],
      selectedItem: null,
      masterPasswordVerified: false,
      // 保留其他状态
    };

  return (
    <AppContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
```

### 3. 设置界面

**src/components/SettingsPanel.tsx** (新文件):
```tsx
import React, { useState, useEffect } from 'react';
import { Lock, Clock, Monitor } from 'lucide-react';
import api from '../lib/tauri-api';

export default function SettingsPanel() {
  const [config, setConfig] = useState({
    enabled: true,
    idle_timeout_minutes: 5,
    lock_on_minimize: true,
    lock_on_tab_switch: true,
    lock_on_sleep: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await api.getAutoLockConfig?.();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await api.setAutoLockConfig?.(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(`Failed to save: ${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="border-b border-surface2 pb-6">
        <h2 className="flex items-center text-lg font-bold text-text mb-4">
          <Lock className="w-5 h-5 mr-2" />
          Auto-Lock Settings
        </h2>

        {/* 全局开关 */}
        <label className="flex items-center p-3 rounded bg-surface mb-4">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
            className="checkbox"
          />
          <span className="ml-3 font-medium text-text">
            Enable Auto-Lock
          </span>
        </label>

        {config.enabled && (
          <div className="space-y-4">
            {/* 空闲超时 */}
            <div>
              <label className="flex items-center text-sm font-medium text-text mb-2">
                <Clock className="w-4 h-4 mr-2" />
                Idle Timeout (minutes)
              </label>
              <input
                type="range"
                min="1"
                max="60"
                value={config.idle_timeout_minutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    idle_timeout_minutes: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <p className="text-sm text-text2 mt-1">
                Current: {config.idle_timeout_minutes} minutes
              </p>
            </div>

            {/* 锁定触发条件 */}
            <div className="bg-surface rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-text">
                Lock when:
              </p>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.lock_on_minimize}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lock_on_minimize: e.target.checked,
                    })
                  }
                  className="checkbox"
                />
                <span className="ml-2 text-sm text-text">
                  Application is minimized
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.lock_on_tab_switch}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lock_on_tab_switch: e.target.checked,
                    })
                  }
                  className="checkbox"
                />
                <span className="ml-2 text-sm text-text">
                  Browser tab loses focus
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.lock_on_sleep}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      lock_on_sleep: e.target.checked,
                    })
                  }
                  className="checkbox"
                />
                <span className="ml-2 text-sm text-text">
                  System goes to sleep
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 保存按钮 */}
      <div className="flex space-x-3">
        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="btn flex-1"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-success text-sm flex items-center">
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  );
}
```

### 4. 更新 tauri-api.ts

**src/lib/tauri-api.ts**:
```typescript
getAutoLockConfig: async (): Promise<any> => {
  return await invoke('get_auto_lock_config');
},

setAutoLockConfig: async (config: any): Promise<void> => {
  return await invoke('set_auto_lock_config', { config });
},

lockVault: async (): Promise<void> => {
  return await invoke('lock_vault');
},

getLockStatus: async (): Promise<boolean> => {
  return await invoke('get_lock_status');
},

resetActivityTimer: async (): Promise<void> => {
  return await invoke('reset_activity_timer');
},
```

---

## 用户体验流程

### 场景 1：空闲超时
```
14:30 用户在应用中操作
14:35 用户停止操作
14:40 触发自动锁定（5分钟超时）
    → 显示 PasswordScreen
    → 用户需要重新输入密码
```

### 场景 2：最小化
```
用户点击最小化
    ↓
立即触发锁定（如果启用）
    ↓
用户恢复应用
    ↓
显示 PasswordScreen
```

### 场景 3：系统唤醒
```
系统休眠
    ↓
用户唤醒系统
    ↓
应用检测唤醒事件
    ↓
显示 PasswordScreen
```

---

## 测试清单

### 后端测试
- [ ] 配置文件正确保存和加载
- [ ] 空闲计时器正确计算
- [ ] 所有锁定事件正确触发
- [ ] 活动计时器重置有效

### 前端测试
- [ ] useAutoLock hook 正确监听事件
- [ ] 用户活动重置计时器
- [ ] 设置界面显示所有选项
- [ ] 配置保存后生效

### 集成测试
- [ ] 空闲超时后锁定
- [ ] 最小化立即锁定（如启用）
- [ ] 焦点丧失立即锁定（如启用）
- [ ] 重新输入密码后解锁
- [ ] 设置更改后立即生效

---

## 安全考虑

### 敏感数据清除

锁定时清除的数据：
- [ ] vaultItems 列表
- [ ] selectedItem 详情
- [ ] 剪贴板数据？（可选）
- [ ] 临时密钥（如果存在）

### 不清除的数据

维系应用状态：
- [ ] 用户名
- [ ] 项目列表
- [ ] 搜索历史

---

## 性能和资源

| 指标 | 值 | 说明 |
|------|-----|------|
| 检查间隔 | 10秒 | 低 CPU 开销 |
| 事件监听 | 异步 | 不阻塞 UI |
| 配置持久化 | JSON | 轻量级存储 |
| 内存占用 | <1MB | 最小开销 |

---

## 实现时间

- **后端**：4-6 小时
  - 配置系统：1.5 小时
  - 事件监听：2 小时
  - 命令实现：1-1.5 小时

- **前端**：4-6 小时
  - useAutoLock hook：1.5 小时
  - 设置界面：2 小时
  - AppContext 集成：1.5 小时

**总计**：8-12 小时（1-1.5 天）

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 4 个优先事项（P1）。

```markdown
- [x] Chrome 导入 (3-4 days) ✓
- [x] 剪贴板监听器 (30 min) ✓
- [x] 导入冲突处理 (1-2 days) ✓
- [ ] 智能自动锁定 (1-1.5 days) - 在此处
```

---

**最后更新**: 2026-02-15
**难度**: ⭐⭐ 中等（多线程/事件驱动设计）
**对用户的影响**: 很高（关键安全功能）
