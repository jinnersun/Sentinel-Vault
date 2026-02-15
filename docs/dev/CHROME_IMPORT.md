# Chrome 密码导入功能详细设计

## 概述

本文档详细说明如何实现从 Chrome 浏览器导入保存的密码到 DevVault。

---

## 技术架构

### 数据流图
```
Chrome Browser
    ↓
Login Data (SQLite Database) [Encrypted with DPAPI/Keychain]
    ↓
Tauri Backend (read_chrome_passwords)
    ↓
[Decrypt + Parse]
    ↓
ChromePassword Array
    ↓
React Frontend (ImportDialog)
    ↓
User Selection (Handle Conflicts)
    ↓
Batch Create VaultItems
    ↓
SQLite DevVault DB
```

---

## 后端实现 (Rust + Tauri)

### 1. 添加依赖

**Cargo.toml**:
```toml
[dependencies]
# ... existing deps ...
rusqlite = { version = "0.29", features = ["bundled"] }
dirs = "5.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# For decryption
# Windows DPAPI
#[cfg(windows)]
# dpapi-rs = "0.1"

# Mac Keychain
#[cfg(target_os = "macos")]
# keychain-manager = "0.1"
```

### 2. 定义数据结构

**src-tauri/src/commands.rs** 顶部添加:
```rust
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromePassword {
    pub origin: String,      // https://example.com
    pub username: String,
    pub password: String,
    pub signon_realm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub success_count: usize,
    pub error_count: usize,
    pub duplicate_count: usize,
    pub errors: Vec<String>,
}
```

### 3. Chrome 数据库路径解析

```rust
fn get_chrome_login_data_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let user_profile = std::env::var("USERPROFILE")
            .map_err(|_| "Cannot find user profile".to_string())?;
        Ok(PathBuf::from(format!(
            "{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data",
            user_profile
        )))
    }
    
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "Cannot find home directory".to_string())?;
        Ok(PathBuf::from(format!(
            "{}/.config/google-chrome/Default/Login Data",
            home
        )))
    }
    
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "Cannot find home directory".to_string())?;
        Ok(PathBuf::from(format!(
            "{}/.config/google-chrome/Default/Login Data",
            home
        )))
    }
}
```

### 4. Chrome 数据库读取

```rust
#[command]
pub async fn read_chrome_passwords() -> Result<Vec<ChromePassword>, String> {
    let db_path = get_chrome_login_data_path()?;
    
    // Chrome 数据库通常被锁定，需要复制到临时位置
    let temp_path = std::env::temp_dir().join("chrome_login_data.tmp");
    std::fs::copy(&db_path, &temp_path)
        .map_err(|e| format!("Failed to copy Chrome database: {}", e))?;
    
    // 打开复制的数据库
    let conn = rusqlite::Connection::open(&temp_path)
        .map_err(|e| format!("Failed to open Chrome database: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT origin_url, username_value, password_value, signon_realm FROM logins"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let passwords = stmt.query_map([], |row| {
        Ok(ChromePassword {
            origin: row.get(0)?,
            username: row.get(1)?,
            password: row.get(2)?,
            signon_realm: row.get(3)?,
        })
    }).map_err(|e| format!("Failed to query Chrome database: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect passwords: {}", e))?;
    
    // 清理临时文件
    let _ = std::fs::remove_file(&temp_path);
    
    Ok(passwords)
}
```

### 5. Chrome 密码解密 (复杂部分)

Chrome 在 Windows 上使用 DPAPI 加密，Mac 上使用 Keychain。需要调用系统 API。

**Windows (DPAPI)**:
```rust
#[cfg(target_os = "windows")]
fn decrypt_chrome_password(encrypted: &[u8]) -> Result<String, String> {
    // 需要使用 Win32 API DPAPI
    // 或使用 dpapi-ng crate
    // 这里是伪代码
    Ok(String::from_utf8_lossy(encrypted).to_string())
}
```

**暂时方案**：
```rust
// 当前 Chrome 新版本密码存储在 SQLite 中已解密
// 或者提示用户导出密码为 CSV 文件（Chrome Settings → Passwords → Export）
#[command]
pub async fn import_passwords_from_csv(file_path: String) -> Result<ImportResult, String> {
    // 实现 CSV 解析
    // 返回导入结果
    Ok(ImportResult {
        success_count: 0,
        error_count: 0,
        duplicate_count: 0,
        errors: vec![],
    })
}
```

---

## 前端实现 (React)

### 1. ImportDialog 组件

**src/components/ImportDialog.tsx**:
```tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../lib/tauri-api';

interface ImportItem {
  url: string;
  username: string;
  password: string;
  conflict?: boolean;
  action?: 'import' | 'skip' | 'rename';
}

export default function ImportDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refreshData } = useApp();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Record<number, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChromePasswords();
    }
  }, [isOpen]);

  const loadChromePasswords = async () => {
    setIsLoading(true);
    setError('');
    try {
      const passwords = await api.readChromePasswords();
      // 检测冲突
      const itemsWithConflict = passwords.map((p, idx) => ({
        ...p,
        id: idx,
        conflict: false,
        action: 'import',
      }));
      setItems(itemsWithConflict);
    } catch (err) {
      setError(`Failed to read Chrome passwords: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const action = selectedAction[i] || 'import';

        if (action === 'skip') {
          continue;
        }

        try {
          const url = new URL(item.url).origin;
          await api.createVaultItem({
            title: item.username || new URL(item.url).hostname,
            secret_encrypted: item.password,
            url,
            notes: `Imported from Chrome`,
            category: 'Password',
            project_id: null,
            color: '#3b82f6',
            favicon_url: undefined,
            is_archived: false,
          });
          successCount++;
        } catch (itemError) {
          errorCount++;
        }

        setImportProgress((i / items.length) * 100);
      }

      await refreshData();
      alert(`Import complete: ${successCount} imported, ${errorCount} failed`);
      onClose();
    } catch (err) {
      setError(`Import failed: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-surface2">
          <h2 className="text-xl font-bold text-text">
            <Download className="inline mr-2" />
            Import Chrome Passwords
          </h2>
        </div>

        {error && (
          <div className="p-4 bg-error bg-opacity-20 border border-error text-error">
            <AlertCircle className="inline mr-2" />
            {error}
          </div>
        )}

        {isLoading && importProgress > 0 && (
          <div className="p-4">
            <div className="w-full bg-surface2 rounded overflow-hidden">
              <div
                className="bg-accent h-2 transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-center text-sm text-text2 mt-2">{Math.round(importProgress)}%</p>
          </div>
        )}

        {isLoading && !items.length ? (
          <div className="p-8 text-center">
            <p className="text-text2">Loading Chrome passwords...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-warning" />
            <p className="text-text2">No passwords found in Chrome</p>
          </div>
        ) : (
          <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center p-3 bg-surface rounded gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text truncate">{item.username || item.url}</p>
                  <p className="text-sm text-text2 truncate">{item.url}</p>
                </div>
                <select
                  value={selectedAction[idx] || 'import'}
                  onChange={(e) =>
                    setSelectedAction({ ...selectedAction, [idx]: e.target.value })
                  }
                  className="input text-sm py-1"
                >
                  <option value="import">Import</option>
                  <option value="skip">Skip</option>
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 border-t border-surface2 flex space-x-3">
          <button onClick={handleImport} disabled={isLoading || !items.length} className="btn flex-1">
            {isLoading ? 'Importing...' : `Import ${items.length} items`}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. 集成到 Toolbar

**src/components/Toolbar.tsx** 中添加:
```tsx
import { Download } from 'lucide-react';

// 在 Toolbar 中添加导入按钮
<button
  onClick={() => setImportDialogOpen(true)}
  className="btn btn-sm flex items-center space-x-2"
  title="Import passwords"
>
  <Download className="w-4 h-4" />
  <span>Import</span>
</button>

// 添加 ImportDialog 组件
<ImportDialog
  isOpen={importDialogOpen}
  onClose={() => setImportDialogOpen(false)}
/>
```

### 3. 更新 tauri-api.ts

**src/lib/tauri-api.ts** 中添加:
```typescript
readChromePasswords: async (): Promise<ChromePassword[]> => {
  return await invoke('read_chrome_passwords');
},

importPasswordsFromCsv: async (filePath: string): Promise<ImportResult> => {
  return await invoke('import_passwords_from_csv', { filePath });
},
```

---

## 测试清单

### 后端测试
- [ ] Chrome 数据库路径正确识别
- [ ] 能够复制 Chrome 数据库文件
- [ ] 能够解析 logins 表
- [ ] 返回密码列表正确

### 前端测试
- [ ] ImportDialog 正确显示密码列表
- [ ] 能够选择导入/跳过
- [ ] 导入进度条显示正确
- [ ] 导入成功后显示统计
- [ ] 错误处理正确

### 集成测试
- [ ] 导入的密码在主界面显示
- [ ] 导入的密码可以复制
- [ ] 导入的密码可以编辑/删除
- [ ] 多次导入不会创建重复

---

## 权限和安全问题

### Windows
- 需要访问 `%USERPROFILE%\AppData\Local\Google\Chrome\User Data`
- Chrome 可能正在运行时无法访问数据库（文件被锁定）
- 解决方案：复制到临时位置再读取

### macOS
- 需要访问 `~/.config/google-chrome`
- 可能需要用户授权（文件访问权限）
- 需要调用 Keychain API 解密密码

### Linux
- 需要访问 `~/.config/google-chrome`
- 密码可能未加密或使用 Keyring 保存

---

## 故障排查

### "Chrome database is locked"
→ Chrome 正在运行，关闭后重试

### "Failed to read Chrome database"
→ Chrome 路径不正确或数据库格式不兼容

### "Import failed"
→ 检查 VaultItem 字段是否有效

---

## 后续可能的改进

1. **增量导入** - 只导入新添加的密码
2. **定期同步** - 定时从 Chrome 同步
3. **其他浏览器** - Firefox、Safari 等
4. **密码强度分析** - 导入时检测弱密码
5. **批量导出** - 导出为加密的备份文件

---

**最后更新**: 2026-02-15
