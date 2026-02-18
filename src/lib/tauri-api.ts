import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import type { VaultItem, Project, ApiKey, SecurityOverview, SecurityAlert, SSLCertificate, Domain, DomainInfoResult } from '../types';

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

  // Settings
  getSetting: async (key: string): Promise<string | null> => {
    return await invoke('get_setting', { key });
  },

  updateSetting: async (key: string, value: string): Promise<void> => {
    return await invoke('update_setting', { key, value });
  },

  backupDatabase: async (targetPath: string): Promise<void> => {
    return await invoke('backup_database', { targetPath });
  },

  clearAllData: async (): Promise<void> => {
    return await invoke('clear_all_data');
  },

  // Security Center
  getSecurityOverview: async (): Promise<SecurityOverview> => {
    return await invoke('get_security_overview');
  },

  getSecurityAlerts: async (): Promise<SecurityAlert[]> => {
    return await invoke('get_security_alerts');
  },

  updateVaultItemSecurity: async (
    id: number,
    params: {
      last_rotated_at?: string;
      enable_rotation_reminder?: boolean;
      rotation_reminder_days?: number;
      api_expires_at?: string;
      enable_expiry_alert?: boolean;
      expiry_alert_days?: number;
    }
  ): Promise<void> => {
    return await invoke('update_vault_item_security', { id, ...params });
  },

  // Certificate Management
  uploadCertificate: async (params: {
    cert_name: string;
    cert_content: string;
    key_content?: string;
    chain_content?: string;
    notes?: string;
  }): Promise<SSLCertificate> => {
    return await invoke('upload_certificate', { request: params });
  },

  getCertificates: async (): Promise<SSLCertificate[]> => {
    return await invoke('get_certificates');
  },

  deleteCertificate: async (id: number): Promise<void> => {
    return await invoke('delete_certificate', { id });
  },

  readCertificateFile: async (certId: number, fileType: 'cert' | 'key' | 'chain'): Promise<string> => {
    return await invoke('read_certificate_file', { certId, fileType });
  },

  copyCertificateToClipboard: async (certId: number, fileType: 'cert' | 'key' | 'chain'): Promise<void> => {
    return await invoke('copy_certificate_to_clipboard', { certId, fileType });
  },

  getCertificateFilePath: async (certId: number, fileType: 'cert' | 'key' | 'chain'): Promise<string> => {
    return await invoke('get_certificate_file_path', { certId, fileType });
  },

  // Domain Info (RDAP)
  fetchDomainInfo: async (domain: string): Promise<DomainInfoResult> => {
    return await invoke('fetch_domain_info', { domain });
  },

  syncDomainInfo: async (domainId: number, domain: string): Promise<DomainInfoResult> => {
    return await invoke('sync_domain_info', { domainId, domain });
  },

  // Domain Management
  getDomains: async (): Promise<Domain[]> => {
    return await invoke('get_domains');
  },

  createDomain: async (params: Omit<Domain, 'id' | 'created_at' | 'updated_at' | 'servers' | 'certificates'>): Promise<number> => {
    return await invoke('create_domain', { request: params });
  },

  updateDomain: async (params: Omit<Domain, 'created_at' | 'updated_at' | 'servers' | 'certificates'> & { id: number }): Promise<void> => {
    return await invoke('update_domain', { request: params });
  },

  deleteDomain: async (id: number): Promise<void> => {
    return await invoke('delete_domain', { id });
  },

  linkDomainServer: async (domainId: number, serverId: number): Promise<void> => {
    return await invoke('link_domain_server', { domainId, serverId });
  },

  unlinkDomainServer: async (domainId: number, serverId: number): Promise<void> => {
    return await invoke('unlink_domain_server', { domainId, serverId });
  },

  getExpiringDomains: async (days: number): Promise<Domain[]> => {
    return await invoke('get_expiring_domains', { days });
  },

  // Server-Domain-Certificate Relations
  getServerDomains: async (serverId: number): Promise<{ id: number; domain: string; expiry_date?: string }[]> => {
    return await invoke('get_server_domains', { serverId });
  },

  getServerCertificates: async (serverId: number): Promise<{ id: number; cert_name: string; domains: string[]; expires_at: string }[]> => {
    return await invoke('get_server_certificates', { serverId });
  },

  getCertificateServers: async (certificateId: number): Promise<{ id: number; title: string; ip?: string }[]> => {
    return await invoke('get_certificate_servers', { certificateId });
  },

  // Event listeners
  listenForClipboardEvents: (callback: () => void) => {
    return listen('clipboard-change', callback);
  },
};

export default api;