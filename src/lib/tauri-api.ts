import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import type { VaultItem, Project } from '../types';

export const api = {
  // Vault Items
  createVaultItem: async (item: Omit<VaultItem, 'id'>): Promise<number> => {
    return await invoke('create_vault_item', { item });
  },

  getVaultItems: async (): Promise<VaultItem[]> => {
    return await invoke('get_vault_items');
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

  // Event listeners
  listenForClipboardEvents: (callback: () => void) => {
    return listen('clipboard-change', callback);
  },
};

export default api;