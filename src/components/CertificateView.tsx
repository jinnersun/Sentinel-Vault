import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Trash2, Copy, FileText, Key, Link2, CheckCircle, X } from 'lucide-react';
import type { SSLCertificate } from '../types';
import api from '../lib/tauri-api';

interface CertificateViewProps {
  onClose: () => void;
}

const CertificateView: React.FC<CertificateViewProps> = ({ onClose }) => {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  // 加载证书列表
  const loadCertificates = async () => {
    try {
      setLoading(true);
      const data = await api.getCertificates();
      setCertificates(data);
    } catch (error) {
      console.error('Failed to load certificates:', error);
      alert('加载证书列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  // 过滤证书
  const filteredCerts = certificates.filter(c =>
    c.cert_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.domains.some(d => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.issuer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 检查证书状态
  const getCertStatus = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'warning';
    if (daysUntilExpiry <= 30) return 'normal';
    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'text-red-500 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'normal': return 'text-green-500 bg-green-50 border-green-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'expired': return '已过期';
      case 'warning': return '即将过期';
      case 'normal': return '正常';
      default: return '良好';
    }
  };

  // 复制证书内容
  const handleCopy = async (certId: number, fileType: 'cert' | 'key' | 'chain', label: string) => {
    try {
      setCopying(label);
      await api.copyCertificateToClipboard(certId, fileType);
      setTimeout(() => setCopying(null), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('复制失败');
      setCopying(null);
    }
  };

  // 删除证书
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此证书吗？')) return;
    try {
      await api.deleteCertificate(id);
      await loadCertificates();
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      alert('删除证书失败');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">SSL证书管理</h1>
              <p className="text-sm text-gray-500">管理SSL证书和关联域名</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              上传证书
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
            placeholder="搜索证书名称、域名或颁发机构..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Certificate List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : filteredCerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无证书</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 text-green-600 hover:text-green-700"
            >
              上传第一个证书
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCerts.map((cert) => {
              const status = getCertStatus(cert.expires_at);
              return (
                <div
                  key={cert.id}
                  className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{cert.cert_name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(status)}`}>
                          {getStatusText(status)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="text-gray-400">颁发机构:</span> {cert.issuer || '-'}
                        </div>
                        <div>
                          <span className="text-gray-400">过期时间:</span> {cert.expires_at}
                        </div>
                      </div>

                      {/* 域名列表 */}
                      <div className="mb-3">
                        <span className="text-sm text-gray-400">包含域名:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {cert.domains.map((domain, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                              {domain}
                            </span>
                          ))}
                        </div>
                      </div>

                      {cert.notes && (
                        <p className="text-sm text-gray-500 mb-3">{cert.notes}</p>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(cert.id!, 'cert', `cert-${cert.id}`)}
                          disabled={copying === `cert-${cert.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          {copying === `cert-${cert.id}` ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copying === `cert-${cert.id}` ? '已复制' : '复制证书'}
                        </button>
                        
                        {cert.key_file_path && (
                          <button
                            onClick={() => handleCopy(cert.id!, 'key', `key-${cert.id}`)}
                            disabled={copying === `key-${cert.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            {copying === `key-${cert.id}` ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Key className="w-4 h-4" />
                            )}
                            {copying === `key-${cert.id}` ? '已复制' : '复制私钥'}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSelectedCert(cert)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          查看详情
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleDelete(cert.id!)}
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

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadCertificateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            loadCertificates();
            setShowUploadModal(false);
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedCert && (
        <CertificateDetailModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
          onCopy={handleCopy}
          copying={copying}
        />
      )}
    </div>
  );
};

// 上传证书模态框
interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const UploadCertificateModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({
    cert_name: '',
    cert_content: '',
    key_content: '',
    chain_content: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cert_name.trim() || !form.cert_content.trim()) {
      alert('请输入证书名称和证书内容');
      return;
    }

    try {
      setLoading(true);
      await api.uploadCertificate({
        cert_name: form.cert_name,
        cert_content: form.cert_content,
        key_content: form.key_content || undefined,
        chain_content: form.chain_content || undefined,
        notes: form.notes || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to upload certificate:', error);
      alert('上传证书失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">上传SSL证书</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">证书名称 *</label>
            <input
              type="text"
              value={form.cert_name}
              onChange={(e) => setForm(prev => ({ ...prev, cert_name: e.target.value }))}
              placeholder="例如：example.com-2024"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证书内容 (PEM格式) *
            </label>
            <textarea
              value={form.cert_content}
              onChange={(e) => setForm(prev => ({ ...prev, cert_content: e.target.value }))}
              rows={6}
              placeholder="-----BEGIN CERTIFICATE-----..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-xs resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              私钥内容 (可选)
            </label>
            <textarea
              value={form.key_content}
              onChange={(e) => setForm(prev => ({ ...prev, key_content: e.target.value }))}
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-xs resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证书链 (可选)
            </label>
            <textarea
              value={form.chain_content}
              onChange={(e) => setForm(prev => ({ ...prev, chain_content: e.target.value }))}
              rows={4}
              placeholder="-----BEGIN CERTIFICATE-----..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-xs resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="证书用途说明..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
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
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? '上传中...' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 证书详情模态框
interface DetailModalProps {
  certificate: SSLCertificate;
  onClose: () => void;
  onCopy: (certId: number, fileType: 'cert' | 'key' | 'chain', label: string) => void;
  copying: string | null;
}

const CertificateDetailModal: React.FC<DetailModalProps> = ({ certificate, onClose, onCopy, copying }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{certificate.cert_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">颁发机构:</span>
              <p className="font-medium">{certificate.issuer || '-'}</p>
            </div>
            <div>
              <span className="text-gray-400">过期时间:</span>
              <p className="font-medium">{certificate.expires_at}</p>
            </div>
          </div>

          <div>
            <span className="text-gray-400 text-sm">包含域名:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {certificate.domains.map((domain, idx) => (
                <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                  {domain}
                </span>
              ))}
            </div>
          </div>

          {certificate.notes && (
            <div>
              <span className="text-gray-400 text-sm">备注:</span>
              <p className="text-sm mt-1">{certificate.notes}</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">操作</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onCopy(certificate.id!, 'cert', `cert-${certificate.id}-detail`)}
                disabled={copying === `cert-${certificate.id}-detail`}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              >
                {copying === `cert-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copying === `cert-${certificate.id}-detail` ? '已复制' : '复制证书'}
              </button>
              
              {certificate.key_file_path && (
                <button
                  onClick={() => onCopy(certificate.id!, 'key', `key-${certificate.id}-detail`)}
                  disabled={copying === `key-${certificate.id}-detail`}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  {copying === `key-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                  {copying === `key-${certificate.id}-detail` ? '已复制' : '复制私钥'}
                </button>
              )}
              
              {certificate.chain_file_path && (
                <button
                  onClick={() => onCopy(certificate.id!, 'chain', `chain-${certificate.id}-detail`)}
                  disabled={copying === `chain-${certificate.id}-detail`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {copying === `chain-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copying === `chain-${certificate.id}-detail` ? '已复制' : '复制证书链'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateView;
