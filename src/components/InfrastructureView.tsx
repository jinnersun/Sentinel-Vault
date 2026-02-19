import { useApp } from '../contexts/AppContext';
import { Server, Database, Plus, Copy, Eye, EyeOff, Trash2, Edit2, X, Globe, Shield, AlertTriangle } from 'lucide-react';
import { parseAssetNotes, type ServerAsset, type DatabaseAsset } from '../types';
import { useState, useEffect } from 'react';
import api from '../lib/tauri-api';
import InfrastructureModal from './InfrastructureModal';

// 数据库连接字符串模板
const CONNECTION_TEMPLATES: Record<string, string> = {
  'MySQL': 'mysql://{user}:{pass}@{host}:{port}/{db}',
  'PostgreSQL': 'postgresql://{user}:{pass}@{host}:{port}/{db}',
  'MongoDB': 'mongodb://{user}:{pass}@{host}:{port}/{db}?authSource=admin',
  'Redis': 'redis://:{pass}@{host}:{port}/0',
  'SQLServer': 'sqlserver://{user}:{pass}@{host}:{port};database={db}',
  'Oracle': 'oracle://{user}:{pass}@{host}:{port}/{db}',
};

// 生成连接字符串
function generateConnectionString(dbType: string, username: string, password: string, host: string, port: number, database: string): string {
  const template = CONNECTION_TEMPLATES[dbType] || CONNECTION_TEMPLATES['MySQL'];
  return template
    .replace('{user}', username || 'root')
    .replace('{pass}', password)
    .replace('{host}', host)
    .replace('{port}', (port || 3306).toString())
    .replace('{db}', database || '');
}

// 服务器关联资源缓存
interface ServerRelations {
  domains: { id: number; domain: string; expiry_date?: string }[];
  certificates: { id: number; cert_name: string; domains: string[]; expires_at: string }[];
}

export default function InfrastructureView() {
  const { state, dispatch } = useApp();
  const [showSecrets, setShowSecrets] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'server' | 'database'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<typeof infrastructureItems[0] | null>(null);
  const [serverRelations, setServerRelations] = useState<Map<number, ServerRelations>>(new Map());
  const [loadingRelations, setLoadingRelations] = useState<Set<number>>(new Set());

  // 过滤出基础设施资产（Server 和 Database 类别）
  const infrastructureItems = state.vaultItems.filter(
    item => item.category === 'Server' || item.category === 'Database'
  );

  // 加载所有服务器的关联资源（在组件顶层统一加载）
  useEffect(() => {
    const serverItems = infrastructureItems.filter(item => item.category === 'Server');
    serverItems.forEach(item => {
      if (item.id && !serverRelations.has(item.id) && !loadingRelations.has(item.id)) {
        loadServerRelations(item.id);
      }
    });
  }, [infrastructureItems.map(item => item.id).join(',')]);

  const servers = infrastructureItems.filter(item => item.category === 'Server');
  const databases = infrastructureItems.filter(item => item.category === 'Database');

  const displayedItems = activeTab === 'all' 
    ? infrastructureItems 
    : activeTab === 'server' 
      ? servers 
      : databases;

  // 加载服务器关联资源
  const loadServerRelations = async (serverId: number) => {
    if (serverRelations.has(serverId) || loadingRelations.has(serverId)) return;
    
    setLoadingRelations(prev => new Set(prev).add(serverId));
    try {
      const [domains, certificates] = await Promise.all([
        api.getServerDomains(serverId),
        api.getServerCertificates(serverId),
      ]);
      
      setServerRelations(prev => {
        const next = new Map(prev);
        next.set(serverId, { domains, certificates });
        return next;
      });
    } catch (error) {
      console.error('Failed to load server relations:', error);
    } finally {
      setLoadingRelations(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  };

  // 检查证书状态
  const getCertStatus = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'warning';
    return 'good';
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加 toast 提示
      console.log(`已复制 ${label}`);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 检查服务器关联的域名
  const checkServerRelations = async (serverId: number): Promise<{ domains: string[] }> => {
    try {
      const domains = await api.getServerDomains(serverId);
      return { domains: domains.map(d => d.domain) };
    } catch (error) {
      console.error('检查关联失败:', error);
      return { domains: [] };
    }
  };

  // 修复：改进的删除逻辑，带有关联检查
  const handleDelete = async (item: typeof infrastructureItems[0]) => {
    // 检查是否已在删除中（防止多次点击）
    if (deletingItemId !== null) {
      return;
    }

    // 对于服务器类型，检查关联的域名
    if (item.category === 'Server' && item.id) {
      const relations = await checkServerRelations(item.id);
      if (relations.domains.length > 0) {
        const confirmMsg = `服务器 "${item.title}" 关联了以下域名：\n${relations.domains.join(', ')}\n\n删除服务器将同时解除这些关联关系。是否继续？`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      } else {
        if (!window.confirm(`确定要删除服务器 "${item.title}" 吗？`)) {
          return;
        }
      }
    } else {
      if (!window.confirm(`确定要删除 "${item.title}" 吗？`)) {
        return;
      }
    }

    setDeletingItemId(item.id ?? null);

    try {
      // 关键修改：先调用后端 API，不做乐观更新
      await api.deleteVaultItem(item.id!);
      
      // 只有后端成功返回，才更新本地状态
      dispatch({ type: 'DELETE_VAULT_ITEM', payload: item.id! });
      
      console.log(`成功删除 "${item.title}"`);
    } catch (error) {
      console.error('删除失败:', error);
      alert(`删除 "${item.title}" 失败，请重试\n${error instanceof Error ? error.message : '未知错误'}`);
      // 失败时不需要调用 refreshData，因为我们从未修改本地状态
    } finally {
      setDeletingItemId(null);
    }
  };

  const renderServerCard = (item: typeof infrastructureItems[0]) => {
    const parsed = parseAssetNotes(item.notes);
    const serverData = parsed.data as ServerAsset | null;
    const relations = serverRelations.get(item.id!);
    const isLoading = loadingRelations.has(item.id!);
    
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
              onClick={() => setDetailItem(item)}
              className="p-1.5 hover:bg-surface2 rounded"
              title="查看详情"
            >
              <Eye className="w-4 h-4" />
            </button>
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

          {/* 关联资源区 */}
          <div className="mt-3 pt-3 border-t border-surface2">
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : relations ? (
              <div className="space-y-2">
                {/* 域名标签 */}
                {relations.domains.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-text2 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {relations.domains.map(domain => (
                        <span
                          key={domain.id}
                          className="px-2 py-0.5 text-xs bg-surface2 rounded hover:bg-accent/20 cursor-pointer transition-colors"
                          onClick={() => dispatch({ type: 'SET_CURRENT_VIEW', payload: 'domains' })}
                        >
                          {domain.domain}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 证书状态 */}
                {relations.certificates.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-text2 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {relations.certificates.map(cert => {
                        const status = getCertStatus(cert.expires_at);
                        return (
                          <span
                            key={cert.id}
                            className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                              status === 'expired' ? 'bg-red-500/20 text-red-400' :
                              status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}
                            title={`保护域名: ${cert.domains.join(', ')}`}
                          >
                            {status !== 'good' && <AlertTriangle className="w-3 h-3" />}
                            {cert.cert_name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {relations.domains.length === 0 && relations.certificates.length === 0 && (
                  <p className="text-xs text-text2">暂无关联域名和证书</p>
                )}
              </div>
            ) : null}
          </div>
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
          {dbData?.username && dbData?.host && (
            <div className="flex items-center justify-between bg-surface rounded-lg p-2">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="text-sm text-text2">连接:</span>
                <span className="font-mono text-sm truncate">
                  {generateConnectionString(
                    dbData.db_type || 'MySQL',
                    dbData.username,
                    '****',
                    dbData.host,
                    dbData.port || 3306,
                    dbData.database || ''
                  ).replace(/\?.*$/, '?...')}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(
                  generateConnectionString(
                    dbData.db_type || 'MySQL',
                    dbData.username || '',
                    item.secret_encrypted || '',
                    dbData.host || '',
                    dbData.port || 3306,
                    dbData.database || ''
                  ),
                  '连接字符串'
                )}
                className="p-1 hover:bg-surface2 rounded flex-shrink-0"
                title="复制连接字符串 (Navicat/DBeaver 可用)"
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

      {/* Detail Modal */}
      {detailItem && (
        <ServerDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => {
            setEditingItem(detailItem);
            setIsModalOpen(true);
            setDetailItem(null);
          }}
        />
      )}
    </div>
  );
}

// 服务器详情弹窗组件
interface ServerDetailModalProps {
  item: {
    id?: number;
    title: string;
    secret_encrypted: string;
    notes?: string;
    project_id?: number | null;
  };
  onClose: () => void;
  onEdit: () => void;
}

function ServerDetailModal({ item, onClose, onEdit }: ServerDetailModalProps) {
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const parsed = parseAssetNotes(item.notes);
  const serverData = parsed.data as ServerAsset | null;

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`已复制 ${label}`);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const renderSecretField = (label: string, value: string, key: string, rows: number = 1) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-text">{label}</label>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => toggleSecret(key)}
            className="p-1 hover:bg-surface2 rounded"
            title={showSecrets.has(key) ? '隐藏' : '显示'}
          >
            {showSecrets.has(key) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => copyToClipboard(value, label)}
            className="p-1 hover:bg-surface2 rounded"
            title="复制"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
      {rows > 1 ? (
        <textarea
          readOnly
          value={showSecrets.has(key) ? value : '••••••••••••••••'}
          rows={rows}
          className="w-full px-3 py-2 bg-surface rounded-lg text-sm font-mono resize-none"
        />
      ) : (
        <input
          type="text"
          readOnly
          value={showSecrets.has(key) ? value : '••••••••'}
          className="w-full px-3 py-2 bg-surface rounded-lg text-sm font-mono"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl border border-surface2 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="text-sm text-text2">{serverData?.os || 'Linux'} 服务器</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onEdit}
              className="p-2 hover:bg-surface2 rounded-lg"
              title="编辑"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface2 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-text2 mb-1 block">IP 地址</label>
              <div className="flex items-center space-x-2">
                <span className="font-mono">{serverData?.ip || '-'}</span>
                <button
                  onClick={() => copyToClipboard(serverData?.ip || '', 'IP')}
                  className="p-1 hover:bg-surface2 rounded"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-text2 mb-1 block">端口</label>
              <span className="font-mono">{serverData?.port || 22}</span>
            </div>
            <div>
              <label className="text-sm text-text2 mb-1 block">SSH 用户</label>
              <span>{serverData?.ssh_user || '-'}</span>
            </div>
            <div>
              <label className="text-sm text-text2 mb-1 block">状态</label>
              <span className={`px-2 py-0.5 rounded text-xs ${
                serverData?.status === 'running' ? 'bg-green-500/20 text-green-400' :
                serverData?.status === 'stopped' ? 'bg-red-500/20 text-red-400' :
                serverData?.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-surface2'
              }`}>
                {serverData?.status === 'running' ? '运行中' :
                 serverData?.status === 'stopped' ? '已停止' :
                 serverData?.status === 'maintenance' ? '维护中' : '未知'}
              </span>
            </div>
            {serverData?.region && (
              <div>
                <label className="text-sm text-text2 mb-1 block">区域</label>
                <span>{serverData.region}</span>
              </div>
            )}
            {serverData?.provider && (
              <div>
                <label className="text-sm text-text2 mb-1 block">云服务商</label>
                <span>{serverData.provider}</span>
              </div>
            )}
          </div>

          {/* 标签 */}
          {serverData?.tags && serverData.tags.length > 0 && (
            <div className="mb-6">
              <label className="text-sm text-text2 mb-2 block">标签</label>
              <div className="flex flex-wrap gap-2">
                {serverData.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 bg-surface rounded text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 敏感信息区域 */}
          <div className="border-t border-surface2 pt-4">
            <h3 className="text-sm font-medium mb-4">认证信息</h3>
            
            {renderSecretField('密码', item.secret_encrypted, 'password')}
            
            {serverData?.ssh_key && renderSecretField('SSH 私钥', serverData.ssh_key, 'ssh_key', 4)}
          </div>

          {/* 描述 */}
          {serverData?.description && (
            <div className="border-t border-surface2 pt-4 mt-4">
              <label className="text-sm text-text2 mb-2 block">描述</label>
              <p className="text-sm">{serverData.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
