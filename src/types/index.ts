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

export interface AppState {
  vaultItems: VaultItem[];
  projects: Project[];
  selectedProject: number | null;
  searchQuery: string;
  selectedItem: VaultItem | null;
  isLoading: boolean;
  stealthMode: boolean;
  masterPasswordVerified: boolean;
}