import { useEffect, useState } from 'react';
import api from '../lib/tauri-api';
import { Trash2, Plus, Server, Database, Key, Copy, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VaultItem, parseAssetNotes, ServerAsset, DatabaseAsset } from '../types';

export default function ProjectRelations() {
  const { state, refreshData } = useApp();
  const [linked, setLinked] = useState<VaultItem[]>([]);
  const [unlinked, setUnlinked] = useState<VaultItem[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<number | null>(null);
  const [showSecrets, setShowSecrets] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'server' | 'database' | 'apikey'>('all');

  const projectId = state.selectedProject;

  const load = async () => {
    if (!projectId) return;
    try {
      const [linkedItems, unlinkedItems] = await Promise.all([
        api.getVaultItemsByProject(projectId),
        api.getUnlinkedVaultItems(projectId),
      ]);
      setLinked(linkedItems);
      setUnlinked(unlinkedItems);
      setSelectedToAdd(unlinkedItems.length && unlinkedItems[0].id ? unlinkedItems[0].id : null);
    } catch (e) {
      console.error('Failed to load project relations', e);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleAdd = async () => {
    if (!projectId || selectedToAdd === null) return;
    try {
      await api.createCredentialProjectRelation(selectedToAdd, projectId, 'manual');
      await load();
      await refreshData();
    } catch (e) {
      console.error('Failed to add relation', e);
    }
  };

  const handleRemove = async (credentialId: number) => {
    if (!projectId) return;
    if (!confirm('确定要移除该关联吗？')) return;
    try {
      await api.deleteRelationByCredentialAndProject(projectId, credentialId);
      await load();
      await refreshData();
    } catch (e) {
      console.error('Failed to remove relation', e);
    }
  };

  const toggleSecret = (id: number) => {
    setShowSecrets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  if (!projectId) return null;

  // 按类别分组
  const servers = linked.filter(item => item.category === 'Server');
  const databases = linked.filter(item => item.category === 'Database');
  const apiKeys = linked.filter(item => item.category === 'API');

  const renderServerCard = (item: VaultItem) => {
    const parsed = parseAssetNotes(item.notes);
    const data = parsed.data as ServerAsset | null;
    
    return (
      <div key={item.id} className="card p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-sm">{item.title}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => copyToClipboard(`ssh ${data?.ssh_user}@${data?.ip} -p ${data?.port || 22}`)}
              className="p-1 hover:bg-surface2 rounded"
              title="复制 SSH 命令"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={() => item.id && handleRemove(item.id)}
              className="p-1 hover:bg-surface2 rounded text-error"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="text-xs text-text2 space-y-1">
          <div className="flex items-center justify-between">
            <span>IP: {data?.ip}:{data?.port || 22}</span>
            <button
              onClick={() => copyToClipboard(`${data?.ip}:${data?.port || 22}`)}
              className="p-1 hover:bg-surface2 rounded"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          {data?.ssh_user && (
            <div className="flex items-center justify-between">
              <span>用户: {data.ssh_user}</span>
              <button
                onClick={() => copyToClipboard(data.ssh_user!)}
                className="p-1 hover:bg-surface2 rounded"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>密码: {showSecrets.has(item.id!) ? item.secret_encrypted : '••••••'}</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => toggleSecret(item.id!)}
                className="p-1 hover:bg-surface2 rounded"
              >
                {showSecrets.has(item.id!) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <button
                onClick={() => copyToClipboard(item.secret_encrypted)}
                className="p-1 hover:bg-surface2 rounded"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDatabaseCard = (item: VaultItem) => {
    const parsed = parseAssetNotes(item.notes);
    const data = parsed.data as DatabaseAsset | null;
    
    return (
      <div key={item.id} className="card p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-green-400" />
            <span className="font-medium text-sm">{item.title}</span>
          </div>
          <div className="flex items-center space-x-1">
            {data?.admin_url && (
              <a
                href={data.admin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-surface2 rounded text-accent"
                title="打开管理后台"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={() => item.id && handleRemove(item.id)}
              className="p-1 hover:bg-surface2 rounded text-error"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="text-xs text-text2 space-y-1">
          <div className="flex items-center justify-between">
            <span>{data?.db_type} {data?.host}:{data?.port}</span>
            <button
              onClick={() => copyToClipboard(`${data?.host}:${data?.port}`)}
              className="p-1 hover:bg-surface2 rounded"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span>库: {data?.database}</span>
            <button
              onClick={() => copyToClipboard(data?.database || '')}
              className="p-1 hover:bg-surface2 rounded"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          {data?.username && (
            <div className="flex items-center justify-between">
              <span>用户: {data.username}</span>
              <button
                onClick={() => copyToClipboard(data.username!)}
                className="p-1 hover:bg-surface2 rounded"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>密码: {showSecrets.has(item.id!) ? item.secret_encrypted : '••••••'}</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => toggleSecret(item.id!)}
                className="p-1 hover:bg-surface2 rounded"
              >
                {showSecrets.has(item.id!) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <button
                onClick={() => copyToClipboard(item.secret_encrypted)}
                className="p-1 hover:bg-surface2 rounded"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderApiKeyCard = (item: VaultItem) => (
    <div key={item.id} className="card p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Key className="w-4 h-4 text-yellow-400" />
          <span className="font-medium text-sm">{item.title}</span>
        </div>
        <button
          onClick={() => item.id && handleRemove(item.id)}
          className="p-1 hover:bg-surface2 rounded text-error"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text2 truncate flex-1 mr-2">
          {showSecrets.has(item.id!) ? item.secret_encrypted : '••••••••••••'}
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => toggleSecret(item.id!)}
            className="p-1 hover:bg-surface2 rounded"
          >
            {showSecrets.has(item.id!) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => copyToClipboard(item.secret_encrypted)}
            className="p-1 hover:bg-surface2 rounded"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-surface2 flex-shrink-0">
        <h3 className="text-lg font-semibold mb-3">项目资源管理器</h3>
        
        {/* Tabs */}
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'all' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            全部 ({linked.length})
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'server' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            <Server className="w-3 h-3" />
            <span>服务器 ({servers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'database' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>数据库 ({databases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('apikey')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'apikey' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>API ({apiKeys.length})</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 添加关联 */}
        <div className="mb-4">
          <label className="text-xs text-text2">添加资源到此项目</label>
          <div className="flex items-center space-x-2 mt-1">
            <select
              className="input text-sm py-1.5"
              value={selectedToAdd ?? ''}
              onChange={(e) => setSelectedToAdd(Number(e.target.value))}
            >
              {unlinked.map(u => (
                <option key={u.id} value={u.id}>{u.title} ({u.category})</option>
              ))}
            </select>
            <button onClick={handleAdd} className="btn btn-sm">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 资源列表 */}
        {(activeTab === 'all' || activeTab === 'server') && servers.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-text2 uppercase mb-2 flex items-center space-x-1">
              <Server className="w-3 h-3" />
              <span>服务器</span>
            </h4>
            {servers.map(renderServerCard)}
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'database') && databases.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-text2 uppercase mb-2 flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>数据库</span>
            </h4>
            {databases.map(renderDatabaseCard)}
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'apikey') && apiKeys.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-text2 uppercase mb-2 flex items-center space-x-1">
              <Key className="w-3 h-3" />
              <span>API Keys</span>
            </h4>
            {apiKeys.map(renderApiKeyCard)}
          </div>
        )}

        {linked.length === 0 && (
          <div className="text-text2 text-sm text-center py-8">
            此项目尚未关联任何资源。
          </div>
        )}
      </div>
    </div>
  );
}
