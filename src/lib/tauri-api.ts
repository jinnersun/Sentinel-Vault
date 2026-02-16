import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import type { VaultItem, Project, ApiKey } from '../types';

export const api = {
  // Vault Items
  createVaultItem: async (item: Omit<VaultItem, 'id'>): Promise<number> => {
    return await invoke('create_vault_item', { item });
  },

  getVaultItems: async (): Promise<VaultItem[]> => {
    return await invoke('get_vault_items');
  },

  getVaultItemsByProject: async (projectId?: number | null): Promise<VaultItem[]> => {
    return await invoke('get_vault_items_by_project', { projectId });
  },

  getUnlinkedVaultItems: async (projectId: number): Promise<VaultItem[]> => {
    return await invoke('get_unlinked_vault_items', { projectId });
  },

  createCredentialProjectRelation: async (credentialId: number, projectId: number, relationType?: string): Promise<number> => {
    return await invoke('create_credential_project_relation', { credentialId, projectId, relationType });
  },

  deleteRelationByCredentialAndProject: async (projectId: number, credentialId: number): Promise<void> => {
    return await invoke('delete_relation_by_credential_and_project', { projectId, credentialId });
  },

  // Imports
  getImportRecords: async (): Promise<any[]> => {
    return await invoke('get_import_records');
  },

  deleteImportRecord: async (id: number): Promise<void> => {
    return await invoke('delete_import_record', { id });
  },

  importRecordToVault: async (importId: number): Promise<number> => {
    return await invoke('import_record_to_vault', { importId });
  },

  updateVaultItem: async (id: number, item: VaultItem): Promise<void> => {
    return await invoke('update_vault_item', { id, item });
  },

  deleteVaultItem: async (id: number): Promise<void> => {
    return await invoke('delete_vault_item', { id });
  },

  searchItems: async (query: string): Promise<VaultItem[]> => {
    return await invoke('search_items', { query });
  },

  // Projects
  createProject: async (project: Omit<Project, 'id'>): Promise<number> => {
    return await invoke('create_project', { project });
  },

  getProjects: async (): Promise<Project[]> => {
    return await invoke('get_projects');
  },

  updateProject: async (id: number, project: Omit<Project, 'id'>): Promise<void> => {
    return await invoke('update_project', { id, project });
  },

  deleteProject: async (id: number): Promise<void> => {
    return await invoke('delete_project', { id });
  },

  getProjectCounts: async (): Promise<Project[]> => {
    return await invoke('get_project_counts');
  },

  // API Keys
  createApiKey: async (apiKey: Omit<ApiKey, 'id'>): Promise<number> => {
    return await invoke('create_api_key', { apiKey });
  },

  getApiKeys: async (): Promise<ApiKey[]> => {
    return await invoke('get_api_keys');
  },

  updateApiKey: async (id: number, apiKey: Omit<ApiKey, 'id'>): Promise<void> => {
    return await invoke('update_api_key', { id, apiKey });
  },

  deleteApiKey: async (id: number): Promise<void> => {
    return await invoke('delete_api_key', { id });
  },

  // Utilities
  copyToClipboard: async (text: string): Promise<void> => {
    return await invoke('copy_to_clipboard', { text });
  },

  fetchFavicon: async (url: string): Promise<string> => {
    return await invoke('fetch_favicon', { url });
  },

  // Master Password
  setMasterPassword: async (password: string): Promise<void> => {
    return await invoke('set_master_password', { password });
  },

  hasMasterPassword: async (): Promise<boolean> => {
    return await invoke('has_master_password');
  },

  verifyMasterPassword: async (password: string): Promise<boolean> => {
    return await invoke('verify_master_password', { password });
  },

  // Chrome Import
  parseAndCompareCsv: async (filePath: string): Promise<{
    batch_id: string;
    total_count: number;
    new_items: any[];
    conflict_items: any[];
    identical_count: number;
  }> => {
    return await invoke('parse_and_compare_csv', { filePath });
  },

  processImportBatch: async (batchId: string, decisions: { import_id: number; decision: string }[]): Promise<{
    batch_id: string;
    imported: number;
    updated: number;
    skipped: number;
  }> => {
    return await invoke('process_import_batch', { batchId, decisions });
  },

  getVaultHistory: async (vaultId: number): Promise<any[]> => {
    return await invoke('get_vault_history', { vaultId });
  },

  // Project README
  readProjectReadme: async (path: string): Promise<string> => {
    return await invoke('read_project_readme', { path });
  },

  // Event listeners
  listenForClipboardEvents: (callback: () => void) => {
    return listen('clipboard-change', callback);
  },
};

export default api;