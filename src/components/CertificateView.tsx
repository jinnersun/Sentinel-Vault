import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Trash2, Copy, FileText, Key, Link2, CheckCircle, X, Server } from 'lucide-react';
import type { SSLCertificate } from '../types';
import api from '../lib/tauri-api';
import { useTranslation } from 'react-i18next';

interface CertificateViewProps {
  onClose: () => void;
}

const CertificateView: React.FC<CertificateViewProps> = ({ onClose }) => {
  const { t } = useTranslation();
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
      alert(t('certificate.loadFailed'));
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
      case 'expired': return t('certificate.status.expired');
      case 'warning': return t('certificate.status.expiringSoon');
      case 'normal': return t('certificate.status.normal');
      default: return t('certificate.status.good');
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
      alert(t('certificate.copyFailed'));
      setCopying(null);
    }
  };

  // 删除证书
  const handleDelete = async (id: number) => {
    if (!confirm(t('certificate.delete.confirm'))) return;
    try {
      await api.deleteCertificate(id);
      await loadCertificates();
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      alert(t('certificate.delete.failed'));
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
              <h1 className="text-xl font-semibold text-gray-900">{t('certificate.title')}</h1>
              <p className="text-sm text-gray-500">{t('certificate.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('certificate.uploadBtn')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('common.back')}
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
            placeholder={t('certificate.searchPlaceholder')}
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
            <p>{t('certificate.empty')}</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 text-green-600 hover:text-green-700"
            >
              {t('certificate.uploadFirst')}
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
                          <span className="text-gray-400">{t('certificate.issuer')}:</span> {cert.issuer || '-'}
                        </div>
                        <div>
                          <span className="text-gray-400">{t('certificate.expiryDate')}:</span> {cert.expires_at}
                        </div>
                      </div>

                      {/* 域名列表 */}
                      <div className="mb-3">
                        <span className="text-sm text-gray-400">{t('certificate.domains')}:</span>
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
                          {copying === `cert-${cert.id}` ? t('common.copied') : t('certificate.copyCert')}
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
                            {copying === `key-${cert.id}` ? t('common.copied') : t('certificate.copyKey')}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSelectedCert(cert)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          {t('certificate.viewDetails')}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleDelete(cert.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
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
  const { t } = useTranslation();
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
      alert(t('certificate.upload.errors.required'));
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
      alert(t('certificate.upload.failed', { error: String(error) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t('certificate.upload.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('certificate.upload.certName')} *</label>
            <input
              type="text"
              value={form.cert_name}
              onChange={(e) => setForm(prev => ({ ...prev, cert_name: e.target.value }))}
              placeholder={t('certificate.upload.certNamePlaceholder')}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('certificate.upload.certContent')}
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
              {t('certificate.upload.keyContent')}
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
              {t('certificate.upload.chainContent')}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('certificate.upload.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder={t('certificate.upload.notesPlaceholder')}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('certificate.upload.uploading') : t('certificate.upload.submit')}
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
  const { t } = useTranslation();
  const [servers, setServers] = useState<{ id: number; title: string; ip?: string }[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);

  // 加载部署服务器列表
  useEffect(() => {
    const loadServers = async () => {
      if (!certificate.id) return;
      try {
        setLoadingServers(true);
        const data = await api.getCertificateServers(certificate.id);
        setServers(data);
      } catch (error) {
        console.error('Failed to load certificate servers:', error);
      } finally {
        setLoadingServers(false);
      }
    };
    loadServers();
  }, [certificate.id]);

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
              <span className="text-gray-400">{t('certificate.issuer')}:</span>
              <p className="font-medium">{certificate.issuer || '-'}</p>
            </div>
            <div>
              <span className="text-gray-400">{t('certificate.expiryDate')}:</span>
              <p className="font-medium">{certificate.expires_at}</p>
            </div>
          </div>

          <div>
            <span className="text-gray-400 text-sm">{t('certificate.domains')}:</span>
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
              <span className="text-gray-400 text-sm">{t('certificate.notes')}:</span>
              <p className="text-sm mt-1">{certificate.notes}</p>
            </div>
          )}

          {/* 部署服务器列表 */}
          <div>
            <span className="text-gray-400 text-sm">{t('certificate.deployedServers')}:</span>
            {loadingServers ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="text-sm text-gray-500">{t('common.loading')}</span>
              </div>
            ) : servers.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">{t('certificate.noServers')}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {servers.map(server => (
                  <span
                    key={server.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm"
                    title={server.ip || ''}
                  >
                    <Server className="w-4 h-4" />
                    {server.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">{t('certificate.operations')}</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onCopy(certificate.id!, 'cert', `cert-${certificate.id}-detail`)}
                disabled={copying === `cert-${certificate.id}-detail`}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              >
                {copying === `cert-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copying === `cert-${certificate.id}-detail` ? t('common.copied') : t('certificate.copyCert')}
              </button>
              
              {certificate.key_file_path && (
                <button
                  onClick={() => onCopy(certificate.id!, 'key', `key-${certificate.id}-detail`)}
                  disabled={copying === `key-${certificate.id}-detail`}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  {copying === `key-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                  {copying === `key-${certificate.id}-detail` ? t('common.copied') : t('certificate.copyKey')}
                </button>
              )}
              
              {certificate.chain_file_path && (
                <button
                  onClick={() => onCopy(certificate.id!, 'chain', `chain-${certificate.id}-detail`)}
                  disabled={copying === `chain-${certificate.id}-detail`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {copying === `chain-${certificate.id}-detail` ? <CheckCircle className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copying === `chain-${certificate.id}-detail` ? t('common.copied') : t('certificate.copyChain')}
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
