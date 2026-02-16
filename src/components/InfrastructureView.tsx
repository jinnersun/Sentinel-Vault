import { useApp } from '../contexts/AppContext';
import { Server, Database, Plus, Copy, Eye, EyeOff, Trash2, Edit2 } from 'lucide-react';
import { parseAssetNotes, type ServerAsset, type DatabaseAsset } from '../types';
import { useState } from 'react';
import api from '../lib/tauri-api';
import InfrastructureModal from './InfrastructureModal';

export default function InfrastructureView() {
  const { state, dispatch } = useApp();
  const [showSecrets, setShowSecrets] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'server' | 'database'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // 过滤出基础设施资产（Server 和 Database 类别）
  const infrastructureItems = state.vaultItems.filter(
    item => item.category === 'Server' || item.category === 'Database'
  );

  const servers = infrastructureItems.filter(item => item.category === 'Server');
  const databases = infrastructureItems.filter(item => item.category === 'Database');

  const displayedItems = activeTab === 'all' 
    ? infrastructureItems 
    : activeTab === 'server' 
      ? servers 
      : databases;

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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加 toast 提示
      console.log(`已复制 ${label}`);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleDelete = async (item: typeof infrastructureItems[0]) => {
    if (!window.confirm(`确定要删除 "${item.title}" 吗？`)) return;
    try {
      await api.deleteVaultItem(item.id!);
      dispatch({ type: 'DELETE_VAULT_ITEM', payload: item.id! });
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const renderServerCard = (item: typeof infrastructureItems[0]) => {
    const parsed = parseAssetNotes(item.notes);
    const serverData = parsed.data as ServerAsset | null;
    
    return (
      <div key={item.id} className="card p-4 hover:border-accent transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-text2">{serverData?.os || 'Linux'} 服务器</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              className="p-1.5 hover:bg-surface2 rounded"
              title="编辑"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleSecret(item.id!)}
              className="p-1.5 hover:bg-surface2 rounded"
              title={showSecrets.has(item.id!) ? '隐藏密码' : '显示密码'}
            >
              {showSecrets.has(item.id!) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="p-1.5 hover:bg-surface2 rounded text-error"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* IP 和端口 */}
          <div className="flex items-center justify-between bg-surface rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text2">IP:</span>
              <span className="font-mono text-sm">{serverData?.ip || '-'}</span>
              <span className="text-sm text-text2">:</span>
              <span className="font-mono text-sm">{serverData?.port || 22}</span>
            </div>
            <button
              onClick={() => copyToClipboard(`${serverData?.ip}:${serverData?.port || 22}`, 'IP:端口')}
              className="p-1 hover:bg-surface2 rounded"
              title="复制 IP:端口"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* SSH 命令 */}
          {serverData?.ssh_user && (
            <div className="flex items-center justify-between bg-surface rounded-lg p-2">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="text-sm text-text2">SSH:</span>
                <span className="font-mono text-sm truncate">
                  ssh {serverData.ssh_user}@{serverData.ip} -p {serverData.port || 22}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(
                  `ssh ${serverData.ssh_user}@${serverData.ip} -p ${serverData.port || 22}`,
                  'SSH 命令'
                )}
                className="p-1 hover:bg-surface2 rounded flex-shrink-0"
                title="复制 SSH 命令"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 密码 */}
          <div className="flex items-center justify-between bg-surface rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text2">密码:</span>
              <span className="font-mono text-sm">
                {showSecrets.has(item.id!) ? item.secret_encrypted : '••••••••'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(item.secret_encrypted, '密码')}
              className="p-1 hover:bg-surface2 rounded"
              title="复制密码"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {serverData?.description && (
            <p className="text-sm text-text2 mt-2">{serverData.description}</p>
          )}
        </div>
      </div>
    );
  };

  const renderDatabaseCard = (item: typeof infrastructureItems[0]) => {
    const parsed = parseAssetNotes(item.notes);
    const dbData = parsed.data as DatabaseAsset | null;
    
    return (
      <div key={item.id} className="card p-4 hover:border-accent transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-text2">{dbData?.db_type || 'MySQL'} 数据库</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              className="p-1.5 hover:bg-surface2 rounded"
              title="编辑"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleSecret(item.id!)}
              className="p-1.5 hover:bg-surface2 rounded"
              title={showSecrets.has(item.id!) ? '隐藏密码' : '显示密码'}
            >
              {showSecrets.has(item.id!) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="p-1.5 hover:bg-surface2 rounded text-error"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* Host 和端口 */}
          <div className="flex items-center justify-between bg-surface rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text2">Host:</span>
              <span className="font-mono text-sm">{dbData?.host || '-'}</span>
              <span className="text-sm text-text2">:</span>
              <span className="font-mono text-sm">{dbData?.port || 3306}</span>
            </div>
            <button
              onClick={() => copyToClipboard(`${dbData?.host}:${dbData?.port || 3306}`, 'Host:端口')}
              className="p-1 hover:bg-surface2 rounded"
              title="复制 Host:端口"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* 数据库名 */}
          <div className="flex items-center justify-between bg-surface rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text2">库名:</span>
              <span className="font-mono text-sm">{dbData?.database || '-'}</span>
            </div>
            <button
              onClick={() => copyToClipboard(dbData?.database || '', '库名')}
              className="p-1 hover:bg-surface2 rounded"
              title="复制库名"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* 连接字符串 */}
          {dbData?.username && (
            <div className="flex items-center justify-between bg-surface rounded-lg p-2">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="text-sm text-text2">连接:</span>
                <span className="font-mono text-sm truncate">
                  {dbData.db_type?.toLowerCase().includes('mysql') 
                    ? `mysql://${dbData.username}:****@${dbData.host}:${dbData.port || 3306}/${dbData.database}`
                    : `${dbData.db_type?.toLowerCase()}://${dbData.username}:****@${dbData.host}:${dbData.port || 5432}/${dbData.database}`
                  }
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(
                  `${dbData.db_type?.toLowerCase().includes('mysql') ? 'mysql' : dbData.db_type?.toLowerCase()}://${dbData.username}:${item.secret_encrypted}@${dbData.host}:${dbData.port || 3306}/${dbData.database}`,
                  '连接字符串'
                )}
                className="p-1 hover:bg-surface2 rounded flex-shrink-0"
                title="复制连接字符串"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 密码 */}
          <div className="flex items-center justify-between bg-surface rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text2">密码:</span>
              <span className="font-mono text-sm">
                {showSecrets.has(item.id!) ? item.secret_encrypted : '••••••••'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(item.secret_encrypted, '密码')}
              className="p-1 hover:bg-surface2 rounded"
              title="复制密码"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* 管理后台链接 */}
          {dbData?.admin_url && (
            <a
              href={dbData.admin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-sm text-accent hover:text-accent2 mt-2"
            >
              <span>打开管理后台</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {dbData?.description && (
            <p className="text-sm text-text2 mt-2">{dbData.description}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-surface2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center space-x-2">
            <Server className="w-5 h-5" />
            <span>基础设施资产</span>
          </h2>
          <p className="text-sm text-text2 mt-1">
            共 {servers.length} 台服务器, {databases.length} 个数据库
          </p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="btn btn-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          新建资产
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            全部 ({infrastructureItems.length})
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'server' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>服务器 ({servers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'database' ? 'bg-accent text-white' : 'bg-surface2 hover:bg-surface'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>数据库 ({databases.length})</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text2">
            <Server className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无基础设施资产</p>
            <p className="text-sm mt-1">点击右上角"新建资产"添加服务器或数据库</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedItems.map(item => 
              item.category === 'Server' ? renderServerCard(item) : renderDatabaseCard(item)
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <InfrastructureModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
      />
    </div>
  );
}
