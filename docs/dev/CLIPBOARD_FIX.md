# 剪贴板监听器修复 - 快速修复指南

## 问题描述

当用户使用"Smart Copy"从浏览器、IDE 或其他应用复制内容时，DevVault 应该：
1. 检测剪贴板内容变化
2. 自动识别是否为敏感信息（密码、API Key 等）
3. 可选地显示通知或快速导入选项

**当前问题**：
- 剪贴板监听功能不完整
- ItemModal 中的 clipboard 检查仅在打开时执行一次
- 需要实现实时监听

---

## 实现方案

### 前端优化（快速修复）

#### 1. 创建 Clipboard Hook

**src/hooks/useClipboardMonitor.ts** (新文件):
```typescript
import { useEffect, useCallback, useRef } from 'react';

interface ClipboardMonitorOptions {
  onContentDetected?: (content: string) => void;
  minLength?: number;
  maxLength?: number;
  interval?: number;
}

export function useClipboardMonitor({
  onContentDetected,
  minLength = 8,
  maxLength = 500,
  interval = 2000,
}: ClipboardMonitorOptions) {
  const previousContentRef = useRef<string>('');
  const listenerRef = useRef<number | null>(null);

  const checkClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      
      // 检测内容变化
      if (text !== previousContentRef.current && text.length >= minLength && text.length <= maxLength) {
        // 基本的敏感信息检测
        const isSensitive =
          /^[a-zA-Z0-9._-]{8,}$/.test(text) || // Token-like
          /^[a-zA-Z0-9!@#$%^&*]{8,}$/.test(text) || // Password-like
          text.includes('://'); // URL-like

        if (isSensitive) {
          previousContentRef.current = text;
          onContentDetected?.(text);
        }
      }
    } catch (error) {
      // 权限被拒绝或其他剪贴板错误 - 忽略
      if (
        error instanceof DOMException &&
        error.name !== 'NotAllowedError'
      ) {
        console.debug('Clipboard monitor error:', error.message);
      }
    }
  }, [onContentDetected, minLength, maxLength]);

  useEffect(() => {
    // 启动定时检查
    listenerRef.current = window.setInterval(checkClipboard, interval);

    return () => {
      if (listenerRef.current !== null) {
        window.clearInterval(listenerRef.current);
      }
    };
  }, [checkClipboard, interval]);
}
```

#### 2. 更新 ItemModal

**src/components/ItemModal.tsx** 中的更改:
```tsx
import { useClipboardMonitor } from '../hooks/useClipboardMonitor';

export default function ItemModal({
  isOpen,
  item,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  item?: VaultItem;
  onClose: () => void;
  onSave?: () => void;
}) {
  // ... 现有代码 ...
  
  // 使用剪贴板监听
  useClipboardMonitor({
    onContentDetected: (content) => {
      if (!item && !secret) {
        // 仅在新建项目且字段为空时自动填充
        setSecret(content);
        setAutoFilled(true);
      }
    },
    minLength: 6,
    maxLength: 1000,
    interval: 1500,
  });

  return (
    <div className="modal">
      {/* ... 现有 JSX ... */}
      
      {/* 在表单顶部添加自动填充提示 */}
      {autoFilled && !item && (
        <div className="p-3 bg-info bg-opacity-20 border border-info rounded text-sm text-info">
          ✓ 从剪贴板自动检测到密码
        </div>
      )}
    </div>
  );
}
```

---

### 后端参考实现（如需深度功能）

#### 原生剪贴板监听（Tauri）

**src-tauri/src/commands.rs** 添加:
```rust
use tauri::Manager;
use std::time::Duration;
use std::thread;

#[tauri::command]
pub async fn start_clipboard_monitor(app: tauri::AppHandle) {
    let app_handle = app.clone();
    
    std::thread::spawn(move || {
        let mut last_content = String::new();
        
        loop {
            thread::sleep(Duration::from_secs(2));
            
            // Windows 剪贴板访问
            #[cfg(target_os = "windows")]
            {
                use clipboard_win::get_clipboard;
                if let Ok(content) = get_clipboard::<_, String>() {
                    if content != last_content && content.len() > 8 {
                        // 发送事件到前端
                        let _ = app_handle.emit_all("clipboard-changed", &content);
                        last_content = content;
                    }
                }
            }
            
            // macOS 剪贴板访问
            #[cfg(target_os = "macos")]
            {
                // 使用 objc 库调用 NSPasteboard
                // ...实现细节...
            }
        }
    });
}

#[tauri::command]
pub async fn stop_clipboard_monitor() {
    // 实现停止逻辑
}
```

**src/main.tsx** 中初始化监听:
```typescript
await invoke('start_clipboard_monitor');
```

---

## 测试步骤

### 前端快速修复测试 ✓

1. **打开新项目表单**
   ```
   点击 + 按钮 → ItemModal 打开
   ```

2. **复制密码**
   ```
   在其他应用复制一个密码（至少8字符）
   等待 1.5 秒
   ```

3. **检查自动填充**
   ```
   ✓ 应该在"secret"字段显示复制的内容
   ✓ 应该看到"从剪贴板自动检测到密码"提示
   ```

4. **保存测试**
   ```
   点击保存按钮
   ✓ 应该成功创建新项目
   ✓ 界面应该关闭
   ```

### 边界情况测试

| 场景 | 预期结果 |
|------|---------|
| 复制短文本（<6字符） | 不触发检测 |
| 复制长文本（>1000字符） | 不触发检测 |
| 复制URL | 触发检测 |
| 复制Token | 触发检测 |
| 复制普通文本 | 不触发检测 |
| 重复复制相同内容 | 仅检测一次 |
| 编辑现有项目时复制 | 不自动填充 |

---

## 安全注意事项

### ⚠️ 隐私认注

1. **剪贴板访问权限**
   - 浏览器要求用户显式授权
   - 移动端（iOS 17.5+）会显示指示器
   - 在敏感应用中需要谨慎

2. **内容检测算法**
   - 当前使用简单的正则表达式
   - 不应该保存、记录或分析内容
   - 仅在内存中处理

3. **UI 提示**
   - 始终向用户显示自动填充发生了什么
   - 提供撤销/清除选项
   - 不要在后台静默执行

### 可选：添加设置开关

**src/components/Settings.tsx** 中:
```tsx
<label className="flex items-center space-x-3">
  <input
    type="checkbox"
    checked={clipboardMonitorEnabled}
    onChange={(e) => setClipboardMonitorEnabled(e.target.checked)}
    className="checkbox"
  />
  <span>Enable clipboard auto-detection</span>
</label>
```

---

## 性能考虑

| 指标 | 值 | 说明 |
|------|-----|------|
| 检查间隔 | 1.5s | 平衡检测延迟和 CPU 使用 |
| 最小长度 | 6 字符 | 避免误触发 |
| 最大长度 | 1000 字符 | 合理的密码长度上限 |
| 内存占用 | <1 MB | 仅存储上一条内容 |

---

## 故障排查

### 检测不工作
1. 检查浏览器权限：`Settings > Privacy > Clipboard`
2. 确认 ItemModal 已打开
3. 尝试复制更长的文本（8+ 字符）
4. 查看浏览器控制台日志

### 过度触发
1. 增加 `interval` 值（2000ms）
2. 增加 `minLength` 值（6）
3. 改进敏感信息检测算法

### 在 iframe 中不工作
- Tauri 应用中应该正常工作
- 浏览器 iframe 需要额外权限设置

---

## 扩展功能建议

### Phase 2
- [ ] 支持 Firefox、Safari 等浏览器检测
- [ ] 文件内容检测（.env 文件）
- [ ] 截图内容 OCR（未来）

### Phase 3
- [ ] 自动分类（JWT、API Key、密码等）
- [ ] 快速导入显式对话框
- [ ] 与 Chrome 导入功能集成

---

## 实现时间

- **前端快速修复**: 30 分钟
  - 创建 useClipboardMonitor hook: 15 分钟
  - 集成到 ItemModal: 10 分钟
  - 测试: 5 分钟

- **后端（可选）**: 1 小时
  - 创建 Tauri 命令: 30 分钟
  - 系统剪贴板集成: 20 分钟
  - 事件处理: 10 分钟

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 2 个优先事项（P1）。

在完成此功能后，更新 ROADMAP.md：
```markdown
- [x] 剪贴板监听器修复 (30 min) ✓ 2026-02-15
```

---

**最后更新**: 2026-02-15
**难度**: ⭐ 简单（30 分钟快速修复）
**对用户的影响**: 高（大大简化了新项目创建流程）
