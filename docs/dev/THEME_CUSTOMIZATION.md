# 主题自定义功能设计

## 问题描述

不同用户有不同的审美和可访问性需求：
1. **深色/浅色模式** - 适应环境光和个人偏好
2. **高对比度** - WCAG AAA 无障碍支持
3. **自定义调色板** - 个性化色彩主题
4. **字体和大小** - 可调整的可读性

**需求**：实现灵活的主题系统，支持预设主题和自定义配置。

---

## 主题系统架构

### 配置结构

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub name: String,
    pub mode: ThemeMode,  // "light", "dark", "auto"
    pub preset: ThemePreset,
    
    pub colors: ColorScheme,
    pub typography: Typography,
    pub spacing: SpacingConfig,
    pub accessibility: AccessibilityConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThemeMode {
    Light,
    Dark,
    Auto,  // 跟随系统
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThemePreset {
    Default,
    Nord,
    Dracula,
    OneDark,
    Solarized,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorScheme {
    // 基础色
    pub primary: String,      // "#3b82f6"
    pub secondary: String,    // "#8b5cf6"
    pub accent: String,       // "#ec4899"
    pub success: String,      // "#10b981"
    pub warning: String,      // "#f59e0b"
    pub error: String,        // "#ef4444"
    pub info: String,         // "#0ea5e9"
    
    // 背景色
    pub bg_primary: String,   // "#ffffff" (light) | "#0f172a" (dark)
    pub bg_secondary: String, // "#f8fafc" (light) | "#1e293b" (dark)
    pub bg_tertiary: String,  // "#f1f5f9" (light) | "#334155" (dark)
    
    // 文字色
    pub text_primary: String,   // "#0f172a" (light) | "#f1f5f9" (dark)
    pub text_secondary: String, // "#475569" (light) | "#cbd5e1" (dark)
    pub text_tertiary: String,  // "#94a3b8" (light) | "#64748b" (dark)
    
    // 边框色
    pub border: String,        // "#e2e8f0" (light) | "#334155" (dark)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Typography {
    pub font_family: String,   // "Inter, system-ui, sans-serif"
    pub base_size: u32,        // 16 (px)
    pub line_height: f32,      // 1.5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacingConfig {
    pub scale: f32,            // 1.0 为正常，1.25 为增大
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityConfig {
    pub high_contrast: bool,
    pub reduce_motion: bool,
    pub bold_text: bool,
    pub font_size_scale: f32,  // 0.8 - 1.5
}
```

---

## 预设主题

### 1. Default (DevVault 默认)
```json
{
  "name": "Default",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#8b5cf6",
    "bg_primary": "#ffffff",
    "text_primary": "#0f172a"
  }
}
```

### 2. Nord (北欧风格)
```json
{
  "name": "Nord",
  "colors": {
    "primary": "#88c0d0",
    "secondary": "#81a1c1",
    "bg_primary": "#2e3440",
    "bg_secondary": "#3b4252",
    "text_primary": "#eceff4"
  }
}
```

### 3. Dracula (深紫)
```json
{
  "name": "Dracula",
  "colors": {
    "primary": "#bd93f9",
    "secondary": "#ff79c6",
    "bg_primary": "#282a36",
    "bg_secondary": "#44475a",
    "text_primary": "#f8f8f2"
  }
}
```

---

## 后端实现

### 1. 主题管理命令

**src-tauri/src/commands.rs** 添加:
```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[command]
pub async fn get_theme_config() -> Result<ThemeConfig, String> {
    let config_path = get_theme_config_path()?;
    
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read theme: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Invalid theme config: {}", e))
    } else {
        Ok(ThemeConfig::default())
    }
}

#[command]
pub async fn set_theme_config(config: ThemeConfig) -> Result<(), String> {
    let config_path = get_theme_config_path()?;
    fs::create_dir_all(config_path.parent().unwrap())
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write theme: {}", e))
}

#[command]
pub async fn get_available_presets() -> Result<Vec<String>, String> {
    Ok(vec![
        "Default".to_string(),
        "Nord".to_string(),
        "Dracula".to_string(),
        "OneDark".to_string(),
        "Solarized".to_string(),
    ])
}

#[command]
pub async fn get_preset_theme(preset: String) -> Result<ThemeConfig, String> {
    match preset.as_str() {
        "Nord" => Ok(PRESET_NORD.clone()),
        "Dracula" => Ok(PRESET_DRACULA.clone()),
        "OneDark" => Ok(PRESET_ONEDARK.clone()),
        "Solarized" => Ok(PRESET_SOLARIZED.clone()),
        _ => Ok(ThemeConfig::default()),
    }
}

fn get_theme_config_path() -> Result<PathBuf, String> {
    Ok(dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("devvault")
        .join("theme.json"))
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            name: "Default".to_string(),
            mode: ThemeMode::Auto,
            preset: ThemePreset::Default,
            colors: ColorScheme {
                primary: "#3b82f6".to_string(),
                secondary: "#8b5cf6".to_string(),
                accent: "#ec4899".to_string(),
                success: "#10b981".to_string(),
                warning: "#f59e0b".to_string(),
                error: "#ef4444".to_string(),
                info: "#0ea5e9".to_string(),
                bg_primary: "#ffffff".to_string(),
                bg_secondary: "#f8fafc".to_string(),
                bg_tertiary: "#f1f5f9".to_string(),
                text_primary: "#0f172a".to_string(),
                text_secondary: "#475569".to_string(),
                text_tertiary: "#94a3b8".to_string(),
                border: "#e2e8f0".to_string(),
            },
            typography: Typography {
                font_family: "Inter, system-ui, sans-serif".to_string(),
                base_size: 16,
                line_height: 1.5,
            },
            spacing: SpacingConfig { scale: 1.0 },
            accessibility: AccessibilityConfig {
                high_contrast: false,
                reduce_motion: false,
                bold_text: false,
                font_size_scale: 1.0,
            },
        }
    }
}
```

---

## 前端实现

### 1. 主题 Context

**src/contexts/ThemeContext.tsx** (新文件):
```tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/tauri-api';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeConfig {
  name: string;
  mode: ThemeMode;
  preset: string;
  colors: Record<string, string>;
  typography: {
    font_family: string;
    base_size: number;
    line_height: number;
  };
  accessibility: {
    high_contrast: boolean;
    reduce_motion: boolean;
    bold_text: boolean;
    font_size_scale: number;
  };
}

interface ThemeContextValue {
  config: ThemeConfig;
  setTheme: (config: ThemeConfig) => Promise<void>;
  setPreset: (preset: string) => Promise<void>;
  currentMode: 'light' | 'dark';
  presets: string[];
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ThemeConfig | null>(null);
  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>('light');
  const [presets, setPresets] = useState<string[]>([]);

  useEffect(() => {
    loadTheme();
    loadPresets();
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (config?.mode === 'auto') {
      setCurrentMode(e.matches ? 'dark' : 'light');
      applyTheme(config, e.matches ? 'dark' : 'light');
    }
  };

  const loadTheme = async () => {
    try {
      const savedConfig = await api.getThemeConfig?.();
      if (savedConfig) {
        setConfig(savedConfig);
        
        // 确定当前模式
        let mode: 'light' | 'dark' = 'light';
        if (savedConfig.mode === 'auto') {
          mode = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        } else {
          mode = savedConfig.mode === 'dark' ? 'dark' : 'light';
        }
        
        setCurrentMode(mode);
        applyTheme(savedConfig, mode);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const available = await api.getAvailablePresets?.();
      setPresets(available || []);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const setTheme = async (newConfig: ThemeConfig) => {
    try {
      await api.setThemeConfig?.(newConfig);
      setConfig(newConfig);
      
      // 重新确定模式
      let mode: 'light' | 'dark' = 'light';
      if (newConfig.mode === 'auto') {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else {
        mode = newConfig.mode === 'dark' ? 'dark' : 'light';
      }
      
      setCurrentMode(mode);
      applyTheme(newConfig, mode);
    } catch (error) {
      console.error('Failed to set theme:', error);
      throw error;
    }
  };

  const setPreset = async (preset: string) => {
    try {
      const presetConfig = await api.getPresetTheme?.(preset);
      if (presetConfig) {
        await setTheme(presetConfig);
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
      throw error;
    }
  };

  const applyTheme = (theme: ThemeConfig, mode: 'light' | 'dark') => {
    const root = document.documentElement;
    
    // 设置 CSS 变量
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // 应用模式类
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
    
    // 应用可访问性设置
    if (theme.accessibility.reduce_motion) {
      root.classList.add('reduce-motion');
    }
    
    if (theme.accessibility.high_contrast) {
      root.classList.add('high-contrast');
    }
    
    if (theme.accessibility.bold_text) {
      root.style.fontWeight = '600';
    }
    
    // 应用字体大小缩放
    root.style.setProperty(
      '--font-size-scale',
      theme.accessibility.font_size_scale.toString()
    );
  };

  if (!config || !presets.length) {
    return <div>Loading theme...</div>;
  }

  return (
    <ThemeContext.Provider
      value={{
        config,
        setTheme,
        setPreset,
        currentMode,
        presets,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

### 2. 主题设置面板

**src/components/ThemeSettingsPanel.tsx** (新文件):
```tsx
import React, { useState } from 'react';
import { Palette, Sun, Moon, Monitor, Sliders } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import ColorPicker from './ColorPicker';

export default function ThemeSettingsPanel() {
  const { config, setTheme, setPreset, currentMode, presets } = useTheme();
  const [customColors, setCustomColors] = useState(false);
  const [fontSize, setFontSize] = useState(config.accessibility.font_size_scale);

  const handleModeChange = (mode: 'light' | 'dark' | 'auto') => {
    setTheme({ ...config, mode });
  };

  const handlePresetChange = (preset: string) => {
    setPreset(preset);
  };

  const handleColorChange = (colorKey: string, value: string) => {
    const newColors = { ...config.colors, [colorKey]: value };
    setTheme({ ...config, colors: newColors });
  };

  const handleAccessibilityChange = (key: string, value: any) => {
    const newAccessibility = { ...config.accessibility, [key]: value };
    setTheme({
      ...config,
      accessibility: newAccessibility,
    });
  };

  const handleFontSizeChange = (scale: number) => {
    setFontSize(scale);
    handleAccessibilityChange('font_size_scale', scale);
  };

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* 标题 */}
      <div>
        <h2 className="flex items-center text-lg font-bold text-text mb-2">
          <Palette className="w-5 h-5 mr-2" />
          Theme Customization
        </h2>
        <p className="text-sm text-text2">
          Personalize the appearance and accessibility of DevVault
        </p>
      </div>

      {/* 主题模式 */}
      <div className="card p-6 border border-surface2">
        <h3 className="font-semibold text-text mb-4">Theme Mode</h3>
        <div className="flex space-x-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex-1 p-3 rounded-lg border-2 transition ${
              config.mode === 'light'
                ? 'border-accent bg-accent bg-opacity-10'
                : 'border-surface2'
            }`}
          >
            <Sun className="w-5 h-5 mx-auto mb-2 text-warning" />
            <p className="font-medium text-text">Light</p>
          </button>

          <button
            onClick={() => handleModeChange('dark')}
            className={`flex-1 p-3 rounded-lg border-2 transition ${
              config.mode === 'dark'
                ? 'border-accent bg-accent bg-opacity-10'
                : 'border-surface2'
            }`}
          >
            <Moon className="w-5 h-5 mx-auto mb-2 text-info" />
            <p className="font-medium text-text">Dark</p>
          </button>

          <button
            onClick={() => handleModeChange('auto')}
            className={`flex-1 p-3 rounded-lg border-2 transition ${
              config.mode === 'auto'
                ? 'border-accent bg-accent bg-opacity-10'
                : 'border-surface2'
            }`}
          >
            <Monitor className="w-5 h-5 mx-auto mb-2 text-secondary" />
            <p className="font-medium text-text">Auto</p>
          </button>
        </div>
        <p className="text-xs text-text2 mt-2">
          Current: <strong>{currentMode}</strong>
        </p>
      </div>

      {/* 预设主题 */}
      <div className="card p-6 border border-surface2">
        <h3 className="font-semibold text-text mb-4">Presets</h3>
        <div className="grid grid-cols-2 gap-3">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={`p-3 rounded-lg border-2 transition font-medium ${
                config.preset === preset
                  ? 'border-accent bg-accent bg-opacity-10 text-accent'
                  : 'border-surface2 text-text hover:border-surface'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义颜色 */}
      <div className="card p-6 border border-surface2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">Custom Colors</h3>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={customColors}
              onChange={(e) => setCustomColors(e.target.checked)}
              className="checkbox"
            />
            <span className="text-sm text-text2">Edit colors</span>
          </label>
        </div>

        {customColors && (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(config.colors)
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-text2 capitalize">{key}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 无障碍设置 */}
      <div className="card p-6 border border-surface2">
        <h3 className="flex items-center font-semibold text-text mb-4">
          <Sliders className="w-4 h-4 mr-2" />
          Accessibility
        </h3>

        <div className="space-y-4">
          {/* 字体大小 */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-sm text-text2">Font Size</span>
              <span className="text-sm font-medium text-text">
                {(fontSize * 100).toFixed(0)}%
              </span>
            </label>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.1"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-text2 mt-1">
              Smaller ← → Larger
            </p>
          </div>

          {/* 高对比度 */}
          <label className="flex items-center p-3 rounded bg-surface hover:bg-surface2">
            <input
              type="checkbox"
              checked={config.accessibility.high_contrast}
              onChange={(e) =>
                handleAccessibilityChange('high_contrast', e.target.checked)
              }
              className="checkbox"
            />
            <span className="ml-3 text-sm font-medium text-text">
              High Contrast Mode
            </span>
          </label>

          {/* 减少动画 */}
          <label className="flex items-center p-3 rounded bg-surface hover:bg-surface2">
            <input
              type="checkbox"
              checked={config.accessibility.reduce_motion}
              onChange={(e) =>
                handleAccessibilityChange('reduce_motion', e.target.checked)
              }
              className="checkbox"
            />
            <span className="ml-3 text-sm font-medium text-text">
              Reduce Motion
            </span>
          </label>

          {/* 粗体文本 */}
          <label className="flex items-center p-3 rounded bg-surface hover:bg-surface2">
            <input
              type="checkbox"
              checked={config.accessibility.bold_text}
              onChange={(e) =>
                handleAccessibilityChange('bold_text', e.target.checked)
              }
              className="checkbox"
            />
            <span className="ml-3 text-sm font-medium text-text">
              Bold Text
            </span>
          </label>
        </div>
      </div>

      {/* 预览 */}
      <div className="card p-6 border border-surface2 bg-surface">
        <h3 className="font-semibold text-text mb-3">Preview</h3>
        <div className="space-y-2">
          <p className="text-text">This is primary text</p>
          <p className="text-text2">This is secondary text</p>
          <div className="flex space-x-2 mt-3">
            <button className="btn btn-sm">Primary</button>
            <button className="btn-secondary btn-sm">Secondary</button>
            <button className="btn-danger btn-sm">Danger</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. 在 MainLayout 集成

**src/components/MainLayout.tsx**:
```tsx
import { ThemeProvider } from '../contexts/ThemeContext';
import ThemeSettingsPanel from './ThemeSettingsPanel';

export default function MainLayout() {
  return (
    <ThemeProvider>
      {/* ... 现有代码 ... */}
      
      {/* 在导航菜单中添加设置项 */}
      <button
        onClick={() => setCurrentView('settings')}
        className="flex items-center space-x-2 px-4 py-2"
      >
        <Palette className="w-5 h-5" />
        <span>Settings</span>
      </button>
      
      {/* 条件渲染 */}
      {currentView === 'settings' && <ThemeSettingsPanel />}
    </ThemeProvider>
  );
}
```

### 4. CSS 变量配置

**src/styles/globals.css** 更新:
```css
:root {
  /* 主题颜色 - 由 JavaScript 设置 */
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-accent: #ec4899;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #0ea5e9;

  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-tertiary: #f1f5f9;

  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94a3b8;

  --color-border: #e2e8f0;

  /* 字体大小缩放 */
  --font-size-scale: 1;
}

/* 深色模式 */
.dark {
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;

  --color-text-primary: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  --color-text-tertiary: #64748b;

  --color-border: #334155;
}

/* 使用 CSS 变量 */
body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: calc(16px * var(--font-size-scale));
  font-family: 'Inter', system-ui, sans-serif;
  transition: background-color 0.3s, color 0.3s;
}

.reduce-motion {
  animation: none !important;
  transition: none !important;
}

.high-contrast {
  /* 增加对比度 */
  --color-text-primary: #000000;
  --color-bg-primary: #ffffff;
  --color-border: #000000;
}

.btn {
  background-color: var(--color-primary);
  color: var(--color-bg-primary);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--color-secondary);
}

.card {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-border);
}

input,
textarea,
select {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
```

### 5. 更新 tauri-api.ts

**src/lib/tauri-api.ts**:
```typescript
getThemeConfig: async (): Promise<any> => {
  return await invoke('get_theme_config');
},

setThemeConfig: async (config: any): Promise<void> => {
  return await invoke('set_theme_config', { config });
},

getAvailablePresets: async (): Promise<string[]> => {
  return await invoke('get_available_presets');
},

getPresetTheme: async (preset: string): Promise<any> => {
  return await invoke('get_preset_theme', { preset });
},
```

---

## 用户体验流程

### 场景 1：选择预设主题
```
1. 打开 Settings → Theme
2. 点击 "Nord" 预设
3. 主题立即切换 ✓
4. 所有颜色和字体应用
5. 设置自动保存
```

### 场景 2：自定义颜色
```
1. 打开 Settings → Theme
2. 启用 "Edit colors"
3. 点击颜色对话框
4. 选择新颜色
5. 预览实时更新 ✓
```

### 场景 3：无障碍调整
```
1. 打开 Settings → Theme
2. 增加字体大小到 120%
3. 启用 "High Contrast Mode"
4. 启用 "Reduce Motion"
5. 应用立即适应 ✓
```

---

## 测试清单

### 后端测试
- [ ] 主题配置正确保存和加载
- [ ] 所有预设主题正确返回
- [ ] 自定义颜色被保存
- [ ] 无障碍设置生效

### 前端测试
- [ ] Light/Dark/Auto 模式切换正常
- [ ] 预设主题应用正确
- [ ] 颜色选择器工作正常
- [ ] 字体大小缩放实时显示
- [ ] 高对比度模式启用
- [ ] 减少动画生效
- [ ] 主题设置持久化

### 集成测试
- [ ] 刷新页面后主题不变
- [ ] 系统主题变化时自动模式适应
- [ ] 所有组件正确应用主题
- [ ] 文本对比度满足 WCAG AA 标准

---

## 实现时间

- **后端**：2-3 小时
  - 命令实现：1 小时
  - 预设配置：1 小时  
  - 持久化：30 分钟

- **前端**：6-8 小时
  - ThemeContext：1.5 小时
  - 设置面板：2 小时
  - CSS 变量系统：2 小时
  - 集成和测试：1-2 小时

**总计**：8-11 小时（约 1 天）

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 7 个优先事项（P2）。

```markdown
- [x] Chrome 导入 (3-4 days) ✓
- [x] 剪贴板监听器 (30 min) ✓
- [x] 导入冲突处理 (1-2 days) ✓
- [x] 智能自动锁定 (1-1.5 days) ✓
- [x] 隐身模式选项 (6-8 hours) ✓
- [x] 数据统计面板 (1.5 days) ✓
- [ ] 主题自定义 (8-11 hours) - 在此处
```

---

**最后更新**: 2026-02-15
**难度**: ⭐⭐ 中等（CSS 变量系统需要协调）
**对用户的影响**: 高（改善用户体验和可访问性）
