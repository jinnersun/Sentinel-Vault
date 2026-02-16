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

export type ViewType = 'vault' | 'imports' | 'apikeys' | 'settings' | 'infrastructure';

// 基础设施资产类型
export interface ServerAsset {
  ip: string;
  port: number;
  os: 'Linux' | 'Windows' | 'macOS' | string;
  ssh_user?: string;
  description?: string;
}

export interface DatabaseAsset {
  db_type: 'MySQL' | 'PostgreSQL' | 'MongoDB' | 'Redis' | string;
  host: string;
  port: number;
  database: string;
  username?: string;
  description?: string;
  admin_url?: string;
}

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
}