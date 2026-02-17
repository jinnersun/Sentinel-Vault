export interface VaultItem {
  id?: number;
  title: string;
  secret_encrypted: string;
  url?: string;
  notes?: string;
  category: string;
  project_id?: number | null;
  color: string;
  favicon_url?: string;
  is_archived: boolean;
}

export interface Project {
  id?: number;
  name: string;
  color: string;
  count?: number;
  status: string;
  description: string;
  arch_desc: string;
  readme_path?: string;
  urls_json: string;
}

export interface ProjectUrl {
  name: string;
  url: string;
  icon?: string;
}

export interface CreateVaultItemRequest {
  title: string;
  secret: string;
  url?: string;
  notes?: string;
  category: string;
  project_id?: number | null;
  color?: string;
}

export interface UpdateVaultItemRequest extends Partial<CreateVaultItemRequest> {
  id: number;
}

export type CopyFormat = 'raw' | 'env' | 'json';

export type ViewType = 'vault' | 'imports' | 'apikeys' | 'settings' | 'infrastructure' | 'security' | 'domains' | 'certificates';

// 基础设施资产类型
export interface ServerAsset {
  ip: string;
  port: number;
  os: 'Linux' | 'Windows' | 'macOS' | string;
  ssh_user?: string;
  description?: string;
  // 扩展字段
  ssh_key?: string;           // SSH 私钥（用于密钥登录）
  ssl_cert?: string;          // SSL 证书内容
  ssl_key?: string;           // SSL 私钥内容
  region?: string;            // 服务器区域/机房
  provider?: string;          // 云服务商（阿里云/AWS/腾讯云等）
  tags?: string[];            // 标签数组
  status?: 'running' | 'stopped' | 'maintenance' | string;  // 服务器状态
  // 租期相关字段
  server_start_date?: string;      // 服务器租期开始时间
  server_end_date?: string;        // 服务器租期结束时间
  server_is_permanent?: boolean;   // 是否永久使用
  server_enable_expiry_alert?: boolean;  // 是否启用到期提醒
  server_expiry_alert_days?: number;     // 到期前提醒天数（默认30）
}

export interface DatabaseAsset {
  db_type: 'MySQL' | 'PostgreSQL' | 'MongoDB' | 'Redis' | string;
  host: string;
  port: number;
  database: string;
  username?: string;
  description?: string;
  admin_url?: string;
  // 租期相关字段
  service_start_date?: string;      // 服务租期开始时间
  service_end_date?: string;        // 服务租期结束时间
  service_is_permanent?: boolean;   // 是否永久使用
  service_enable_expiry_alert?: boolean;  // 是否启用到期提醒
  service_expiry_alert_days?: number;     // 到期前提醒天数（默认30）
}

// 导出安全中心类型
export * from './security';

// 解析 notes 字段中的基础设施资产信息
export function parseAssetNotes(notes?: string): { type: 'server' | 'database' | null; data: ServerAsset | DatabaseAsset | null } {
  if (!notes) return { type: null, data: null };
  try {
    const parsed = JSON.parse(notes);
    if (parsed.asset_type === 'server') {
      return { type: 'server', data: parsed as ServerAsset };
    }
    if (parsed.asset_type === 'database') {
      return { type: 'database', data: parsed as DatabaseAsset };
    }
  } catch {
    // 不是 JSON 格式，返回 null
  }
  return { type: null, data: null };
}

// 构建基础设施资产的 notes 字段
export function buildAssetNotes(type: 'server', data: ServerAsset): string;
export function buildAssetNotes(type: 'database', data: DatabaseAsset): string;
export function buildAssetNotes(type: 'server' | 'database', data: ServerAsset | DatabaseAsset): string {
  return JSON.stringify({ asset_type: type, ...data });
}

export interface ApiKey {
  id?: number;
  name: string;
  key_value: string;
  owner_id?: number | null;
  scope?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppState {
  vaultItems: VaultItem[];
  projects: Project[];
  selectedProject: number | null;
  selectedCategory: string | null;
  searchQuery: string;
  selectedItem: VaultItem | null;
  isLoading: boolean;
  stealthMode: boolean;
  masterPasswordVerified: boolean;
  currentView: ViewType;
  hasUnsavedChanges: boolean;
  saveCallback: (() => Promise<void>) | null;
  securityAlertCount: number;  // 安全中心提醒数量
}

// 域名信息查询结果 (RDAP)
export interface DomainInfoResult {
  domain: string;
  registrar: string | null;
  registration_date: string | null;
  expiry_date: string | null;
  name_servers: string[];
  status: string[];
  source: string; // "rdap" | "rdap-bootstrap" | "unavailable"
}