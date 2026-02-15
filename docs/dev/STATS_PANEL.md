# 数据统计面板详细设计

## 问题描述

用户需要了解其密码库的概览和趋势：
1. **安全指标** - 弱密码、重复密码、过期密码等
2. **库大小** - 项目数量、分类分布
3. **活动日志** - 最近访问、修改历史
4. **导出报告** - 周期性的数据快照

**需求**：创建一个仪表板，显示密码库的关键指标和统计。

---

## 功能设计

### 主仪表板要素

```
┌─────────────────────────────────────────────┐
│        Password Vault Statistics            │
├─────────────────────────────────────────────┤
│  总项目数    │  弱密码数  │  重复密码数     │
│   48        │    5      │      2         │
├─────────────────────────────────────────────┤
│         按分类分布 (饼图)                     │
│   Email(12) 📧                              │
│   Social(15) 👥                             │
│   Banking(8) 🏦                             │
│   Other(13) 📌                              │
├─────────────────────────────────────────────┤
│         密码强度分布 (条形图)                 │
│   强度 ████████░ 30 (62%)                  │
│   中等 ████░░░░░ 15 (31%)                  │
│   弱   ██░░░░░░░ 3 (6%)                    │
├─────────────────────────────────────────────┤
│         最近活动                              │
│   修改了 Gmail 账户密码       2 小时前       │
│   创建了新项目 AWS API        1 天前        │
├─────────────────────────────────────────────┤
```

---

## 数据模型

### 统计指标

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct VaultStatistics {
    // 基本指标
    pub total_items: usize,
    pub total_projects: usize,
    pub last_modified: String,
    pub last_backup: Option<String>,
    
    // 安全指标
    pub weak_passwords: usize,
    pub duplicate_passwords: usize,
    pub unused_items: usize,  // 30+ 天未访问
    pub old_passwords: usize,   // 90+ 天未修改
    
    // 分类分布
    pub categories: Map<String, usize>,
    
    // 密码强度分布
    pub strength_distribution: StrengthDistribution,
    
    // 活动数据
    pub recent_activity: Vec<ActivityEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StrengthDistribution {
    pub strong: usize,
    pub medium: usize,
    pub weak: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub timestamp: u64,
    pub item_id: String,
    pub item_title: String,
    pub action: String,  // "created", "modified", "viewed", "copied"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordStrengthAnalysis {
    pub item_id: String,
    pub title: String,
    pub strength: PasswordStrength,
    pub issues: Vec<String>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PasswordStrength {
    Weak,
    Medium,
    Strong,
    VeryStrong,
}
```

---

## 后端实现

### 1. 统计收集命令

**src-tauri/src/commands.rs** 添加:
```rust
#[command]
pub async fn get_vault_statistics(
    state: tauri::State<'_, AppState>,
) -> Result<VaultStatistics, String> {
    let db = &state.db;
    let items = db.get_all_vault_items()
        .map_err(|e| format!("DB error: {}", e))?;
    
    if items.is_empty() {
        return Ok(VaultStatistics {
            total_items: 0,
            total_projects: 0,
            last_modified: String::new(),
            last_backup: None,
            weak_passwords: 0,
            duplicate_passwords: 0,
            unused_items: 0,
            old_passwords: 0,
            categories: Default::default(),
            strength_distribution: StrengthDistribution {
                strong: 0,
                medium: 0,
                weak: 0,
            },
            recent_activity: vec![],
        });
    }
    
    // 计算统计
    let mut stats = VaultStatistics {
        total_items: items.len(),
        total_projects: db.get_all_projects()
            .map(|p| p.len())
            .unwrap_or(0),
        last_modified: get_last_modified(&items),
        last_backup: None,
        weak_passwords: 0,
        duplicate_passwords: 0,
        unused_items: 0,
        old_passwords: 0,
        categories: HashMap::new(),
        strength_distribution: StrengthDistribution {
            strong: 0,
            medium: 0,
            weak: 0,
        },
        recent_activity: get_recent_activity(&items, 10),
    };
    
    // 计算分类分布
    for item in &items {
        *stats.categories.entry(item.category.clone()).or_insert(0) += 1;
    }
    
    // 计算密码强度和问题
    for item in &items {
        let strength = analyze_password_strength(&item.secret_encrypted);
        
        match strength {
            PasswordStrength::Strong => stats.strength_distribution.strong += 1,
            PasswordStrength::Medium => stats.strength_distribution.medium += 1,
            PasswordStrength::Weak => {
                stats.strength_distribution.weak += 1;
                stats.weak_passwords += 1;
            }
            _ => {}
        }
    }
    
    // 检查重复密码
    let mut password_count = HashMap::new();
    for item in &items {
        *password_count.entry(item.secret_encrypted.clone()).or_insert(0) += 1;
    }
    stats.duplicate_passwords = password_count.values()
        .filter(|&&count| count > 1)
        .count();
    
    // 计算长时间未使用的项目
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let thirty_days_ago = now - (30 * 24 * 60 * 60);
    
    stats.unused_items = items.iter()
        .filter(|item| {
            let last_accessed = item.last_accessed.unwrap_or(item.created_at);
            last_accessed < thirty_days_ago
        })
        .count();
    
    Ok(stats)
}

fn analyze_password_strength(password: &str) -> PasswordStrength {
    let mut score = 0;
    
    if password.len() >= 12 { score += 2; } else if password.len() >= 8 { score += 1; }
    if password.chars().any(|c| c.is_uppercase()) { score += 1; }
    if password.chars().any(|c| c.is_lowercase()) { score += 1; }
    if password.chars().any(|c| c.is_numeric()) { score += 1; }
    if password.chars().any(|c| !c.is_alphanumeric()) { score += 2; }
    
    match score {
        0..=2 => PasswordStrength::Weak,
        3..=4 => PasswordStrength::Medium,
        5..=6 => PasswordStrength::Strong,
        _ => PasswordStrength::VeryStrong,
    }
}

fn get_last_modified(items: &[VaultItem]) -> String {
    items.iter()
        .map(|item| item.updated_at)
        .max()
        .map(|ts| format_timestamp(ts))
        .unwrap_or_default()
}

fn get_recent_activity(items: &[VaultItem], limit: usize) -> Vec<ActivityEntry> {
    // 从数据库读取活动日志
    // 这需要在数据库中添加活动表
    vec![]
}

#[command]
pub async fn get_password_strength_report() -> Result<Vec<PasswordStrengthAnalysis>, String> {
    // 详细的密码强度报告
    // 返回每个项目的强度分析和建议
    Ok(vec![])
}

#[command]
pub async fn export_statistics(output_format: String) -> Result<String, String> {
    // 导出为 PDF、CSV 或 JSON
    // 返回文件路径
    Ok(String::new())
}
```

### 2. 活动日志表

在数据库迁移中添加：
```sql
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_title TEXT NOT NULL,
    action TEXT NOT NULL,  -- "created", "modified", "viewed", "copied"
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE
);

-- 创建索引以提高查询速度
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_item ON activity_log(item_id);
```

### 3. 日志记录系统

```rust
#[command]
pub async fn log_activity(
    action: String,
    item_id: String,
    item_title: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    db.add_activity_log(
        nanoid::nanoid!(),
        &item_id,
        &item_title,
        &action,
        timestamp,
    ).map_err(|e| format!("Failed to log activity: {}", e))
}
```

---

## 前端实现

### 1. 统计仪表板组件

**src/components/StatsDashboard.tsx** (新文件):
```tsx
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, AlertTriangle, Eye, Download } from 'lucide-react';
import api from '../lib/tauri-api';

interface Statistics {
  total_items: number;
  total_projects: number;
  weak_passwords: number;
  duplicate_passwords: number;
  unused_items: number;
  old_passwords: number;
  categories: Record<string, number>;
  strength_distribution: {
    strong: number;
    medium: number;
    weak: number;
  };
  recent_activity: Array<{
    timestamp: number;
    item_title: string;
    action: string;
  }>;
}

export default function StatsDashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
    // 每 5 分钟刷新一次
    const interval = setInterval(loadStatistics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStatistics = async () => {
    try {
      const data = await api.getVaultStatistics?.();
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="p-6 text-center text-text2">No data available</div>;
  }

  // 准备图表数据
  const categoryData = Object.entries(stats.categories).map(([name, value]) => ({
    name,
    value,
  }));

  const strengthData = [
    { name: 'Strong', value: stats.strength_distribution.strong },
    { name: 'Medium', value: stats.strength_distribution.medium },
    { name: 'Weak', value: stats.strength_distribution.weak },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6 p-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center text-2xl font-bold text-text">
          <TrendingUp className="w-6 h-6 mr-2" />
          Vault Statistics
        </h1>
        <button
          onClick={() => api.exportStatistics?.('pdf')}
          className="btn btn-sm flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Items"
          value={stats.total_items}
          icon="📦"
          color="accent"
        />
        <MetricCard
          label="Projects"
          value={stats.total_projects}
          icon="📁"
          color="info"
        />
        <MetricCard
          label="Weak Passwords"
          value={stats.weak_passwords}
          icon="⚠️"
          color="warning"
        />
        <MetricCard
          label="Duplicates"
          value={stats.duplicate_passwords}
          icon="🔄"
          color="error"
        />
      </div>

      {/* 警告条 */}
      {stats.weak_passwords > 0 && (
        <div className="p-4 bg-warning bg-opacity-20 border border-warning rounded-lg flex space-x-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="font-medium text-warning">
              {stats.weak_passwords} weak password{stats.weak_passwords > 1 ? 's' : ''} detected
            </p>
            <p className="text-sm text-text2">
              Consider updating these passwords to improve security
            </p>
          </div>
        </div>
      )}

      {/* 图表中 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 分类分布 - 饼图 */}
        <div className="card p-4">
          <h3 className="font-semibold text-text mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value})`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 密码强度分布 - 柱状图 */}
        <div className="card p-4">
          <h3 className="font-semibold text-text mb-4">Password Strength</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 最近活动 */}
      <div className="card p-4">
        <h3 className="flex items-center font-semibold text-text mb-4">
          <Eye className="w-4 h-4 mr-2" />
          Recent Activity
        </h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {stats.recent_activity.length === 0 ? (
            <p className="text-sm text-text2">No recent activity</p>
          ) : (
            stats.recent_activity.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded hover:bg-surface"
              >
                <div>
                  <p className="text-sm font-medium text-text">
                    {entry.action === 'copied' ? '📋' : '✏️'} {entry.item_title}
                  </p>
                  <p className="text-xs text-text2">
                    {formatTime(entry.timestamp)}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-surface rounded">
                  {entry.action}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 其他指标 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm text-text2">Unused Items (30+ days)</p>
          <p className="text-2xl font-bold text-text">{stats.unused_items}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-text2">Old Passwords (90+ days)</p>
          <p className="text-2xl font-bold text-text">{stats.old_passwords}</p>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
}

function MetricCard({ label, value, icon, color }: MetricCardProps) {
  return (
    <div className="card p-4">
      <p className="text-2xl mb-2">{icon}</p>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-sm text-text2">{label}</p>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

### 2. 在 MainLayout 中添加菜单项

**src/components/MainLayout.tsx** 修改:
```tsx
import StatsDashboard from './StatsDashboard';

// 在导航菜单中添加
<button
  onClick={() => setCurrentView('stats')}
  className="flex items-center space-x-2 px-4 py-2"
>
  <TrendingUp className="w-5 h-5" />
  <span>Statistics</span>
</button>

// 条件渲染
{currentView === 'stats' && <StatsDashboard />}
```

### 3. 更新 tauri-api.ts

**src/lib/tauri-api.ts**:
```typescript
getVaultStatistics: async (): Promise<any> => {
  return await invoke('get_vault_statistics');
},

getPasswordStrengthReport: async (): Promise<any[]> => {
  return await invoke('get_password_strength_report');
},

exportStatistics: async (format: string): Promise<string> => {
  return await invoke('export_statistics', { outputFormat: format });
},

logActivity: async (action: string, itemId: string, itemTitle: string): Promise<void> => {
  return await invoke('log_activity', { action, itemId, itemTitle });
},
```

### 4. 集成活动日志

在 VaultList 和 ItemModal 中调用：
```tsx
await api.logActivity('copied', item.id, item.title);
await api.logActivity('created', newItem.id, newItem.title);
await api.logActivity('modified', item.id, item.title);
```

---

## 数据可视化

### 使用的库

```json
{
  "devDependencies": {
    "recharts": "^2.10.0"
  }
}
```

### 图表类型

1. **饼图** - 分类分布
2. **柱状图** - 密码强度分布
3. **折线图** - 时间趋势（未来功能）

---

## 测试清单

### 后端测试
- [ ] 统计计算正确
- [ ] 分类分布准确
- [ ] 密码强度分析正确
- [ ] 活动日志记录完整
- [ ] 导出功能正常

### 前端测试
- [ ] 仪表板加载无误
- [ ] 图表显示正确
- [ ] 指标卡片显示准确
- [ ] 警告条件部分正确显示
- [ ] 活动日志显示最新活动

### 集成测试
- [ ] 创建新项目后统计更新
- [ ] 删除项目后统计更新
- [ ] 复制密码被记录
- [ ] 编辑项目被记录

---

## 实现时间

- **后端**：6-8 小时
  - 统计收集：2 小时
  - 强度分析：1.5 小时
  - 活动日志：2 小时
  - 导出功能：1.5 小时

- **前端**：4-5 小时
  - 仪表板组件：2 小时
  - 图表配置：1.5 小时
  - 集成：1 小时

**总计**：10-13 小时（约 1.5 天）

---

## 集成 ROADMAP

此功能是 ROADMAP.md 中第 6 个优先事项（P2）。

---

**最后更新**: 2026-02-15
**难度**: ⭐⭐ 中等（数据库查询和图表集成）
**对用户的影响**: 中等（提供有用的洞察，但不是核心功能）
