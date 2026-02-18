import React, { useState, useEffect } from 'react';
import { Globe, Plus, Search, Server, Shield, Trash2, Edit2, RefreshCw, CheckCircle, Link2, X, Info } from 'lucide-react';
import type { Domain, DomainInfoResult } from '../types';
import api from '../lib/tauri-api';

interface DomainViewProps {
  onClose: () => void;
}

const DomainView: React.FC<DomainViewProps> = ({ onClose }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [linkingDomain, setLinkingDomain] = useState<Domain | null>(null);
  const [servers, setServers] = useState<{ id: number; title: string; ip?: string }[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [syncResult, setSyncResult] = useState<{ domain: string; result: DomainInfoResult } | null>(null);

  // 加载域名列表
  const loadDomains = async () => {
    try {
      setLoading(true);
      const data = await api.getDomains();
      setDomains(data);
    } catch (error) {
      console.error('Failed to load domains:', error);
      alert('加载域名列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  // 过滤域名
  const filteredDomains = domains.filter(d =>
    d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.registrar?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 检查域名是否即将过期
  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return '';
    const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'warning';
    if (daysUntilExpiry <= 30) return 'normal';
    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'text-red-500 bg-red-50';
      case 'warning': return 'text-yellow-500 bg-yellow-50';
      case 'normal': return 'text-green-500 bg-green-50';
      case 'good': return 'text-green-500 bg-green-50';
      default: return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'expired': return '已过期';
      case 'warning': return '即将过期';
      case 'normal': return '正常';
      case 'good': return '良好';
      default: return '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此域名吗？')) return;
    try {
      await api.deleteDomain(id);
      await loadDomains();
    } catch (error) {
      console.error('Failed to delete domain:', error);
      alert('删除域名失败');
    }
  };

  // 同步域名信息
  const [syncingDomain, setSyncingDomain] = useState<number | null>(null);
  const [syncedDomain, setSyncedDomain] = useState<number | null>(null);

  const handleSyncDomain = async (domain: Domain) => {
    if (!domain.id) return;
    try {
      setSyncingDomain(domain.id);
      const result = await api.syncDomainInfo(domain.id, domain.domain);
      
      // 先显示结果，让用户看到获取到了什么
      setSyncResult({ domain: domain.domain, result });
      
      // 强制刷新域名列表
      await loadDomains();
      
      // 标记同步成功
      setSyncedDomain(domain.id);
      setTimeout(() => setSyncedDomain(null), 2000);
    } catch (error) {
      console.error('Failed to sync domain:', error);
      alert('同步域名信息失败: ' + (error as Error).message);
    } finally {
      setSyncingDomain(null);
    }
  };

  // 加载服务器列表
  const loadServers = async () => {
    try {
      setLoadingServers(true);
      // 从 vault 中获取服务器类型的条目
      const items = await api.getVaultItems();
      const serverItems = items.filter(item => item.category === 'Server');
      setServers(serverItems.map(item => ({
        id: item.id!,
        title: item.title,
        ip: item.notes ? JSON.parse(item.notes)?.ip : undefined,
      })));
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoadingServers(false);
    }
  };

  // 打开关联弹窗
  const openLinkModal = async (domain: Domain) => {
    setLinkingDomain(domain);
    await loadServers();
  };

  // 关联服务器
  const handleLinkServer = async (serverId: number) => {
    if (!linkingDomain?.id) return;
    try {
      await api.linkDomainServer(linkingDomain.id, serverId);
      await loadDomains();
      // 保持弹窗打开，刷新关联状态
    } catch (error) {
      console.error('Failed to link server:', error);
      alert('关联服务器失败');
    }
  };

  // 解除关联服务器
  const handleUnlinkServer = async (serverId: number) => {
    if (!linkingDomain?.id) return;
    try {
      await api.unlinkDomainServer(linkingDomain.id, serverId);
      await loadDomains();
    } catch (error) {
      console.error('Failed to unlink server:', error);
      alert('解除关联失败');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">域名管理</h1>
              <p className="text-sm text-gray-500">管理您的域名和关联资源</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加域名
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索域名或注册商..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Domain List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无域名</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              添加第一个域名
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredDomains.map((domain) => {
              const expiryStatus = getExpiryStatus(domain.expiry_date);
              return (
                <div
                  key={domain.id}
                  className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{domain.domain}</h3>
                        {expiryStatus && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(expiryStatus)}`}>
                            {getStatusText(expiryStatus)}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="text-gray-400">注册商:</span> {domain.registrar || '-'}
                        </div>
                        <div>
                          <span className="text-gray-400">注册时间:</span> {domain.registration_date || '-'}
                        </div>
                        <div>
                          <span className="text-gray-400">到期时间:</span> {domain.expiry_date || '-'}
                        </div>
                      </div>

                      {domain.notes && (
                        <p className="text-sm text-gray-500 mb-3">{domain.notes}</p>
                      )}

                      {/* 关联资源 - 服务器标签 */}
                      {domain.servers && domain.servers.length > 0 && (
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <Server className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {domain.servers.map(server => (
                              <span
                                key={server.id}
                                className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 cursor-pointer transition-colors"
                                title={server.ip || ''}
                              >
                                {server.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 关联资源 - 证书标签 */}
                      {domain.certificates && domain.certificates.length > 0 && (
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {domain.certificates.map(cert => {
                              const daysUntilExpiry = Math.ceil((new Date(cert.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              const isExpired = daysUntilExpiry < 0;
                              const isWarning = daysUntilExpiry <= 7;
                              return (
                                <span
                                  key={cert.id}
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    isExpired
                                      ? 'bg-red-50 text-red-600'
                                      : isWarning
                                      ? 'bg-yellow-50 text-yellow-600'
                                      : 'bg-green-50 text-green-600'
                                  }`}
                                  title={`到期时间: ${cert.expires_at}`}
                                >
                                  {cert.cert_name}
                                  {isExpired && ' (已过期)'}
                                  {isWarning && ` (${daysUntilExpiry}天)`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openLinkModal(domain)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="关联服务器"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSyncDomain(domain)}
                        disabled={syncingDomain === domain.id}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="同步信息"
                      >
                        {syncedDomain === domain.id ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : syncingDomain === domain.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingDomain(domain)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(domain.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Server Modal */}
      {linkingDomain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">关联服务器 - {linkingDomain.domain}</h3>
              <button
                onClick={() => setLinkingDomain(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingServers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : servers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无服务器，请先创建服务器资产</p>
              ) : (
                <div className="space-y-2">
                  {servers.map(server => {
                    const isLinked = linkingDomain.servers?.some(s => s.id === server.id);
                    return (
                      <div
                        key={server.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isLinked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{server.title}</p>
                            {server.ip && <p className="text-sm text-gray-500">{server.ip}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => isLinked ? handleUnlinkServer(server.id) : handleLinkServer(server.id)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            isLinked
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          {isLinked ? '解除关联' : '关联'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setLinkingDomain(null)}
                className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Result Modal */}
      {syncResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">同步结果 - {syncResult.domain}</h3>
              </div>
              <button
                onClick={() => setSyncResult(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">数据来源:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    syncResult.result.source === 'rdap' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {syncResult.result.source === 'rdap' ? 'RDAP' : '备用方案'}
                  </span>
                </div>
                
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">获取到的信息:</h4>
                  
                  {syncResult.result.registrar ? (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">注册商:</span>
                      <span className="font-medium">{syncResult.result.registrar}</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">注册商:</span>
                      <span className="text-gray-400 italic">未获取到</span>
                    </div>
                  )}
                  
                  {syncResult.result.registration_date ? (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">注册时间:</span>
                      <span className="font-medium">{syncResult.result.registration_date}</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">注册时间:</span>
                      <span className="text-gray-400 italic">未获取到</span>
                    </div>
                  )}
                  
                  {syncResult.result.expiry_date ? (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">到期时间:</span>
                      <span className={`font-medium ${
                        new Date(syncResult.result.expiry_date) < new Date() 
                          ? 'text-red-600' 
                          : new Date(syncResult.result.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                        {syncResult.result.expiry_date}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm mb-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">到期时间:</span>
                      <span className="text-gray-400 italic">未获取到</span>
                    </div>
                  )}
                </div>
                
                {syncResult.result.name_servers.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">DNS服务器:</h4>
                    <div className="flex flex-wrap gap-1">
                      {syncResult.result.name_servers.map((ns, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          {ns}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {!syncResult.result.registrar && !syncResult.result.expiry_date && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                    <p className="text-sm text-yellow-700">
                      ⚠️ 未能获取到有效的域名信息。可能原因：
                    </p>
                    <ul className="text-xs text-yellow-600 mt-1 list-disc list-inside">
                      <li>域名后缀不支持RDAP查询</li>
                      <li>RDAP服务器暂时不可用</li>
                      <li>域名信息被隐私保护</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setSyncResult(null)}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingDomain) && (
        <DomainModal
          domain={editingDomain}
          onClose={() => {
            setShowAddModal(false);
            setEditingDomain(null);
          }}
          onSave={async (domain) => {
            try {
              if (editingDomain?.id) {
                await api.updateDomain({
                  ...domain,
                  id: editingDomain.id,
                });
              } else {
                await api.createDomain(domain);
              }
              await loadDomains();
              setShowAddModal(false);
              setEditingDomain(null);
            } catch (error) {
              console.error('Failed to save domain:', error);
              alert('保存域名失败');
            }
          }}
        />
      )}
    </div>
  );
};

// Domain Modal Component
interface DomainModalProps {
  domain: Domain | null;
  onClose: () => void;
  onSave: (domain: Domain) => void;
}

const DomainModal: React.FC<DomainModalProps> = ({ domain, onClose, onSave }) => {
  const [form, setForm] = useState<Domain>({
    domain: domain?.domain || '',
    registrar: domain?.registrar || '',
    registration_date: domain?.registration_date || '',
    expiry_date: domain?.expiry_date || '',
    enable_expiry_alert: domain?.enable_expiry_alert ?? true,
    expiry_alert_days: domain?.expiry_alert_days || 30,
    notes: domain?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domain.trim()) return;
    onSave({ ...form, id: domain?.id });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {domain ? '编辑域名' : '添加域名'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="sr-only">关闭</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">域名 *</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="example.com"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">注册商</label>
            <input
              type="text"
              value={form.registrar}
              onChange={(e) => setForm(prev => ({ ...prev, registrar: e.target.value }))}
              placeholder="阿里云 / GoDaddy / Namecheap"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">注册时间</label>
              <input
                type="date"
                value={form.registration_date}
                onChange={(e) => setForm(prev => ({ ...prev, registration_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">到期时间</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enable_expiry_alert}
                onChange={(e) => setForm(prev => ({ ...prev, enable_expiry_alert: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">启用到期提醒</span>
            </label>
            {form.enable_expiry_alert && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">提前</span>
                <input
                  type="number"
                  value={form.expiry_alert_days}
                  onChange={(e) => setForm(prev => ({ ...prev, expiry_alert_days: parseInt(e.target.value) || 30 }))}
                  min={1}
                  max={365}
                  className="w-20 px-2 py-1 border rounded text-center"
                />
                <span className="text-sm text-gray-500">天提醒</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="域名用途说明..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {domain ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DomainView;
