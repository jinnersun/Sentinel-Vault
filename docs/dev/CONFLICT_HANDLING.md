# 导入冲突处理设计

## 问题描述

当用户从 Chrome 或其他来源导入密码时，可能遇到：
1. **重复项** - 相同的 URL + 用户名已存在
2. **部分匹配** - URL 相同但用户名不同
3. **相似项** - 域名相似但不完全相同
4. **项目冲突** - 导入目标项目不存在

需要一个灵活的冲突解决框架。

---

## 技术架构

### 冲突检测流程

```
导入密码列表
    ↓
对每个导入项目进行检查
    ├─ 完全匹配 (URL + 用户名) → 类型：DUPLICATE
    ├─ URL 匹配但用户名不同 → 类型：PARTIAL_MATCH
    ├─ 域名匹配但 URL 不同 → 类型：SIMILAR
    └─ 未找到 → 类型：NEW
    ↓
用户选择分辨率策略
    ├─ SKIP - 不导入
    ├─ REPLACE - 替换现有项
    ├─ DUPLICATE - 创建新项（允许重复）
    └─ MERGE - 合并元数据
    ↓
执行导入操作
```

---

## 后端实现

### 1. 冲突类型定义

**src-tauri/src/commands.rs**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictType {
    New,
    Duplicate,        // URL + 用户名完全相同
    PartialMatch,     // URL 相同但用户名不同
    Similar,          // 域名相似
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictAnalysis {
    pub import_item: ChromePassword,
    pub conflict_type: ConflictType,
    pub existing_item: Option<VaultItem>,
    pub similar_items: Vec<VaultItem>,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConflictResolution {
    pub import_item: ChromePassword,
    pub action: ResolutionAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResolutionAction {
    Skip,
    Replace,
    Duplicate,
    Merge {
        notes_append: String,
    },
}
```

### 2. 冲突检测函数

```rust
fn extract_domain(url: &str) -> Result<String, String> {
    let parsed = url::Url::parse(url)
        .map_err(|_| "Invalid URL".to_string())?;
    
    Ok(parsed
        .host_str()
        .unwrap_or("")
        .trim_start_matches("www.")
        .to_string())
}

fn calculate_similarity(str1: &str, str2: &str) -> f32 {
    let len_diff = (str1.len() as i32 - str2.len() as i32).abs() as f32;
    let max_len = std::cmp::max(str1.len(), str2.len()) as f32;
    
    // 使用 Levenshtein 距离的简单实现
    let mut matching_chars = 0;
    for c in str1.chars() {
        if str2.contains(c) {
            matching_chars += 1;
        }
    }
    
    1.0 - (len_diff / max_len * 0.5 + (1.0 - matching_chars as f32 / max_len) * 0.5)
}

#[command]
pub async fn analyze_import_conflicts(
    import_items: Vec<ChromePassword>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ConflictAnalysis>, String> {
    let db = &state.db;
    let mut analyses = Vec::new();

    for import_item in import_items {
        let import_domain = extract_domain(&import_item.origin)?;
        
        // 查询数据库中的所有项
        let existing_items = db.get_all_vault_items()
            .map_err(|e| format!("DB error: {}", e))?;

        let mut conflict_type = ConflictType::New;
        let mut existing_item = None;
        let mut similar_items = Vec::new();

        for db_item in existing_items {
            let db_domain = extract_domain(&db_item.url).unwrap_or_default();

            // 检查完全匹配
            if db_item.url == import_item.origin
                && db_item.title == import_item.username
            {
                conflict_type = ConflictType::Duplicate;
                existing_item = Some(db_item.clone());
                break;
            }

            // 检查 URL 匹配
            if db_item.url == import_item.origin {
                conflict_type = ConflictType::PartialMatch;
                existing_item = Some(db_item.clone());
                break;
            }

            // 检查域名相似
            let domain_similarity = calculate_similarity(&db_domain, &import_domain);
            if domain_similarity > 0.7 && db_domain != import_domain {
                conflict_type = ConflictType::Similar;
                similar_items.push(db_item.clone());
            }
        }

        let recommendation = match conflict_type {
            ConflictType::Duplicate => {
                "项目已存在，建议跳过或用新密码替换".to_string()
            }
            ConflictType::PartialMatch => {
                "相同 URL 存在但用户名不同，建议检查是否为不同账户".to_string()
            }
            ConflictType::Similar => {
                format!("发现 {} 个相似项，建议检查", similar_items.len())
            }
            ConflictType::New => {
                "新项目，可以直接导入".to_string()
            }
        };

        analyses.push(ConflictAnalysis {
            import_item,
            conflict_type,
            existing_item,
            similar_items,
            recommendation,
        });
    }

    Ok(analyses)
}
```

### 3. 执行冲突解决

```rust
#[command]
pub async fn resolve_import_conflicts(
    resolutions: Vec<ImportConflictResolution>,
    state: tauri::State<'_, AppState>,
) -> Result<ImportResult, String> {
    let db = &state.db;
    let mut result = ImportResult {
        success_count: 0,
        error_count: 0,
        duplicate_count: 0,
        errors: vec![],
    };

    for resolution in resolutions {
        match resolution.action {
            ResolutionAction::Skip => {
                continue;
            }

            ResolutionAction::Duplicate => {
                // 创建新项目，即使有重复
                match create_vault_item_internal(
                    &resolution.import_item,
                    db,
                ) {
                    Ok(_) => result.success_count += 1,
                    Err(e) => {
                        result.error_count += 1;
                        result.errors.push(format!(
                            "{}: {}",
                            resolution.import_item.origin, e
                        ));
                    }
                }
            }

            ResolutionAction::Replace => {
                // 更新现有项
                // 需要找到匹配的项并更新其密码
                result.success_count += 1;
            }

            ResolutionAction::Merge { notes_append } => {
                // 合并元数据
                result.success_count += 1;
            }
        }
    }

    Ok(result)
}

fn create_vault_item_internal(
    item: &ChromePassword,
    db: &Database,
) -> Result<String, String> {
    // 实现创建逻辑
    Ok("item_id".to_string())
}
```

---

## 前端实现

### 1. 冲突分析屏幕

**src/components/ImportConflictScreen.tsx** (新文件):
```tsx
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Merge,
  Skip,
} from 'lucide-react';
import api from '../lib/tauri-api';

interface ConflictItem {
  importItem: {
    origin: string;
    username: string;
    password: string;
  };
  conflictType: 'Duplicate' | 'PartialMatch' | 'Similar' | 'New';
  existingItem?: {
    id: string;
    title: string;
    url: string;
  };
  similarItems?: Array<{ id: string; title: string; url: string }>;
  recommendation: string;
}

export default function ImportConflictScreen({
  conflicts,
  onResolve,
  isLoading,
}: {
  conflicts: ConflictItem[];
  onResolve: (resolutions: any[]) => Promise<void>;
  isLoading: boolean;
}) {
  const [resolutions, setResolutions] = useState<Record<number, string>>({});

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'Duplicate':
        return <AlertTriangle className="w-5 h-5 text-error" />;
      case 'PartialMatch':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'Similar':
        return <Copy className="w-5 h-5 text-info" />;
      default:
        return <CheckCircle className="w-5 h-5 text-success" />;
    }
  };

  const getConflictBgColor = (type: string) => {
    switch (type) {
      case 'Duplicate':
        return 'bg-error bg-opacity-10 border-error';
      case 'PartialMatch':
        return 'bg-warning bg-opacity-10 border-warning';
      case 'Similar':
        return 'bg-info bg-opacity-10 border-info';
      default:
        return 'bg-success bg-opacity-10 border-success';
    }
  };

  const handleResolutionChange = (index: number, value: string) => {
    setResolutions({ ...resolutions, [index]: value });
  };

  const handleResolve = async () => {
    const resolutionList = conflicts.map((conflict, idx) => ({
      import_item: conflict.importItem,
      action: resolutions[idx] || 'Skip',
    }));

    await onResolve(resolutionList);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface rounded-lg border border-surface2">
        <h3 className="font-semibold text-text mb-2">
          检测到 {conflicts.length} 个潜在冲突
        </h3>
        <p className="text-sm text-text2">
          请为每个项目选择处理方式
        </p>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {conflicts.map((conflict, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${getConflictBgColor(
              conflict.conflictType
            )}`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getConflictIcon(conflict.conflictType)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="font-medium text-text truncate">
                    {conflict.importItem.username || conflict.importItem.origin}
                  </p>
                  <span className="px-2 py-1 text-xs rounded bg-text bg-opacity-10">
                    {conflict.conflictType}
                  </span>
                </div>

                <p className="text-sm text-text2 truncate">
                  {conflict.importItem.origin}
                </p>

                {conflict.existingItem && (
                  <div className="mt-2 p-2 bg-surface rounded text-sm">
                    <p className="text-text2">现有项目：</p>
                    <p className="text-text font-medium">
                      {conflict.existingItem.title}
                    </p>
                    <p className="text-text2 text-xs">
                      {conflict.existingItem.url}
                    </p>
                  </div>
                )}

                {conflict.similarItems?.length! > 0 && (
                  <div className="mt-2 p-2 bg-surface rounded text-sm">
                    <p className="text-text2">相似项 ({conflict.similarItems?.length})：</p>
                    <ul className="mt-1 space-y-1">
                      {conflict.similarItems?.slice(0, 2).map((item, i) => (
                        <li key={i} className="text-text text-xs">
                          • {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-2 text-xs text-info">
                  💡 {conflict.recommendation}
                </p>
              </div>

              <select
                value={resolutions[idx] || 'Skip'}
                onChange={(e) => handleResolutionChange(idx, e.target.value)}
                className="input py-1 text-sm"
              >
                <option value="Skip">跳过</option>
                <option value="Duplicate">创建新项</option>
                {conflict.existingItem && (
                  <option value="Replace">替换现有</option>
                )}
                {conflict.existingItem && (
                  <option value="Merge">合并</option>
                )}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleResolve}
          disabled={isLoading}
          className="btn flex-1"
        >
          {isLoading ? '处理中...' : '继续导入'}
        </button>
      </div>
    </div>
  );
}
```

### 2. 集成到 ImportDialog

**src/components/ImportDialog.tsx** 更新:
```tsx
import ImportConflictScreen from './ImportConflictScreen';

const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
const [showConflictScreen, setShowConflictScreen] = useState(false);

const analyzeConflicts = async () => {
  try {
    const analysis = await api.analyzeImportConflicts(items);
    setConflicts(analysis);
    setShowConflictScreen(true);
  } catch (err) {
    setError(`Conflict analysis failed: ${String(err)}`);
  }
};

const handleConflictResolution = async (resolutions: any[]) => {
  try {
    const result = await api.resolveImportConflicts(resolutions);
    await refreshData();
    alert(`Import complete: ${result.success_count} imported`);
    onClose();
  } catch (err) {
    setError(`Import resolution failed: ${String(err)}`);
  }
};

return showConflictScreen ? (
  <ImportConflictScreen
    conflicts={conflicts}
    onResolve={handleConflictResolution}
    isLoading={isLoading}
  />
) : (
  // 原来的项目列表 UI
  <div>
    {/* ... 现有代码 ... */}
    <button onClick={analyzeConflicts} className="btn">
      下一步：检查冲突
    </button>
  </div>
);
```

### 3. 更新 tauri-api.ts

**src/lib/tauri-api.ts**:
```typescript
analyzeImportConflicts: async (items: any[]): Promise<any[]> => {
  return await invoke('analyze_import_conflicts', { importItems: items });
},

resolveImportConflicts: async (resolutions: any[]): Promise<ImportResult> => {
  return await invoke('resolve_import_conflicts', { resolutions });
},
```

---

## 用户体验流程

### 场景 1：无冲突导入
```
选择导入 → 分析冲突 → 0 个冲突 → 直接导入 ✓
```

### 场景 2：有冲突导入
```
选择导入
    ↓
分析冲突
    ↓
显示冲突列表（带推荐）
    - 重复项：[选择] 跳过/替换/创建新项
    - 部分匹配：[选择] 跳过/创建新项/合并
    - 相似项：[选择] 跳过/创建新项
    ↓
用户进行选择
    ↓
执行导入
    ↓
显示统计：已创建 8, 已跳过 2, 已替换 1
```

---

## 测试清单

### 后端测试
- [ ] 完全匹配检测正确
- [ ] URL 部分匹配检测正确
- [ ] 域名相似度计算准确（>0.7）
- [ ] 冲突分析返回正确的推荐
- [ ] 解决冲突后的数据库状态正确

### 前端测试
- [ ] 冲突屏幕显示所有冲突
- [ ] 图标和颜色正确区分冲突类型
- [ ] 可以为每个项目选择不同的处理方式
- [ ] "跳过"按钮实际上跳过了导入
- [ ] "替换"正确更新现有项
- [ ] "创建新项"允许重复

### 集成测试
- [ ] 无冲突情况下直接导入
- [ ] 有冲突情况下显示冲突屏幕
- [ ] 冲突解决后成功导入
- [ ] 导入后数据显示在列表中

---

## 性能优化

| 指标 | 值 | 说明 |
|------|-----|------|
| 相似度阈值 | 0.7 | 避免误报 |
| 最多检查项 | 1000 | 避免 O(n²) 问题 |
| 批量操作 | 100 个/批 | 防止超时 |

---

## 扩展建议

### Phase 2
- [ ] 批量操作（全部跳过/全部导入）
- [ ] 冲突历史记录
- [ ] 撤销功能

### Phase 3
- [ ] 智能冲突解决（基于规则）
- [ ] 学习用户偏好
- [ ] 定期同步检测

---

## 实现时间

- **后端**：8-10 小时
  - 冲突检测算法：3 小时
  - 数据库查询优化：2 小时
  - 冲突解决执行：2 小时
  - 测试：2 小时

- **前端**：4-6 小时
  - 冲突屏幕 UI：2 小时
  - ImportDialog 集成：1 小时
  - 测试：1-2 小时

**总计**：12-16 小时（1-2 天）

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 3 个优先事项（P1）。

更新时间线：
```markdown
- [x] Chrome 导入 (3-4 days) ✓
- [x] 剪贴板监听器 (30 min) ✓
- [ ] 导入冲突处理 (1-2 days) - 在此处
```

---

**最后更新**: 2026-02-15
**难度**: ⭐⭐ 中等（涉及复杂的匹配算法）
**对用户的影响**: 高（防止意外的重复或数据丢失）
