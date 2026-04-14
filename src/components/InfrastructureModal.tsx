import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Server, Database } from 'lucide-react';
import api from '../lib/tauri-api';
import { buildAssetNotes } from '../types';
import { useTranslation } from 'react-i18next';

interface InfrastructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // For editing existing item
}

// 数据库默认端口映射
const DB_DEFAULT_PORTS: Record<string, number> = {
  'MySQL': 3306,
  'PostgreSQL': 5432,
  'MongoDB': 27017,
  'Redis': 6379,
  'SQLServer': 1433,
  'Oracle': 1521,
};

// 数据库管理 URL 模板 - 使用 {host} {port} {database} 占位符
const DB_ADMIN_TEMPLATES: Record<string, string> = {
  'MySQL': 'http://{host}/phpmyadmin',
  'PostgreSQL': 'http://{host}:5050',
  'MongoDB': 'http://{host}:8081',
  'Redis': 'http://{host}:8001',
  'SQLServer': 'http://{host}:1434',
  'Oracle': 'https://{host}:1158/em',
};

// 简单的模板替换函数
function generateAdminUrl(template: string, params: { host: string; port: number; database: string }): string {
  return template
    .replace('{host}', params.host)
    .replace('{port}', params.port.toString())
    .replace('{database}', params.database);
}

export default function InfrastructureModal({ isOpen, onClose, item }: InfrastructureModalProps) {
  const { t } = useTranslation();
  const { state, refreshData } = useApp();
  const [assetType, setAssetType] = useState<'server' | 'database'>('server');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Server form
  const [serverForm, setServerForm] = useState({
    title: '',
    ip: '',
    port: 22,
    os: 'Linux',
    ssh_user: '',
    password: '',
    description: '',
    project_id: null as number | null,
    // 扩展字段
    ssh_key: '',
    region: '',
    provider: '',
    tags: '',
    status: 'running',
    // 租期字段
    server_start_date: '',
    server_end_date: '',
    server_is_permanent: false,
    server_enable_expiry_alert: true,
    server_expiry_alert_days: 30,
  });

  // Database form
  const [dbForm, setDbForm] = useState({
    title: '',
    db_type: 'MySQL',
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    admin_url: '',
    description: '',
    project_id: null as number | null,
    // 租期字段
    service_start_date: '',
    service_end_date: '',
    service_is_permanent: false,
    service_enable_expiry_alert: true,
    service_expiry_alert_days: 30,
  });

  // 跟踪 admin_url 是否为用户手动输入（脏检查）
  const adminUrlManuallyEdited = useRef(false);
  const previousDbType = useRef(dbForm.db_type);

  // 监听数据库类型变化，自动填充默认端口
  useEffect(() => {
    if (assetType !== 'database') return;
    
    const currentDbType = dbForm.db_type;
    const defaultPort = DB_DEFAULT_PORTS[currentDbType];
    
    // 只有当切换数据库类型时才更新端口（如果是新建或切换类型）
    if (previousDbType.current !== currentDbType && defaultPort) {
      // 检查当前端口是否是上一个数据库类型的默认端口，或者是空/0
      const prevDefaultPort = DB_DEFAULT_PORTS[previousDbType.current];
      const shouldUpdatePort = !dbForm.port || dbForm.port === prevDefaultPort || dbForm.port === 0;
      
      if (shouldUpdatePort) {
        setDbForm(prev => ({ ...prev, port: defaultPort }));
      }
      
      previousDbType.current = currentDbType;
    }
  }, [dbForm.db_type, assetType]);

  // 监听 host 和 port 变化，自动生成 admin_url
  useEffect(() => {
    if (assetType !== 'database') return;
    if (!dbForm.host) return;
    
    // 如果用户已手动编辑过 admin_url，则不再自动更新
    if (adminUrlManuallyEdited.current) return;
    
    const template = DB_ADMIN_TEMPLATES[dbForm.db_type];
    if (template && !adminUrlManuallyEdited.current) {
      const suggestedUrl = generateAdminUrl(template, {
        host: dbForm.host,
        port: dbForm.port,
        database: dbForm.database
      });
      setDbForm(prev => ({ ...prev, admin_url: suggestedUrl }));
    }
  }, [dbForm.host, dbForm.port, dbForm.database, dbForm.db_type, assetType]);

  // 处理 admin_url 手动输入
  const handleAdminUrlChange = (value: string) => {
    adminUrlManuallyEdited.current = true;
    setDbForm(prev => ({ ...prev, admin_url: value }));
  };

  useEffect(() => {
    if (isOpen && item) {
      // Editing mode
      if (item.category === 'Server') {
        setAssetType('server');
        try {
          const notes = JSON.parse(item.notes || '{}');
          setServerForm({
            title: item.title,
            ip: notes.ip || '',
            port: notes.port || 22,
            os: notes.os || 'Linux',
            ssh_user: notes.ssh_user || '',
            password: item.secret_encrypted || '',
            description: notes.description || '',
            project_id: item.project_id || null,
            // 扩展字段
            ssh_key: notes.ssh_key || '',
            region: notes.region || '',
            provider: notes.provider || '',
            tags: notes.tags?.join(', ') || '',
            status: notes.status || 'running',
            // 租期字段
            server_start_date: notes.server_start_date || '',
            server_end_date: notes.server_end_date || '',
            server_is_permanent: notes.server_is_permanent || false,
            server_enable_expiry_alert: notes.server_enable_expiry_alert !== false,
            server_expiry_alert_days: notes.server_expiry_alert_days || 30,
          });
        } catch {
          setServerForm(prev => ({ ...prev, title: item.title, password: item.secret_encrypted || '' }));
        }
      } else if (item.category === 'Database') {
        setAssetType('database');
        try {
          const notes = JSON.parse(item.notes || '{}');
          setDbForm({
            title: item.title,
            db_type: notes.db_type || 'MySQL',
            host: notes.host || '',
            port: notes.port || 3306,
            database: notes.database || '',
            username: notes.username || '',
            password: item.secret_encrypted || '',
            admin_url: notes.admin_url || '',
            description: notes.description || '',
            project_id: item.project_id || null,
            // 租期字段
            service_start_date: notes.service_start_date || '',
            service_end_date: notes.service_end_date || '',
            service_is_permanent: notes.service_is_permanent || false,
            service_enable_expiry_alert: notes.service_enable_expiry_alert !== false,
            service_expiry_alert_days: notes.service_expiry_alert_days || 30,
          });
        } catch {
          setDbForm(prev => ({ ...prev, title: item.title, password: item.secret_encrypted || '' }));
        }
      }
    } else if (isOpen && !item) {
      // New item mode - reset forms
      setAssetType('server');
      setServerForm({
        title: '',
        ip: '',
        port: 22,
        os: 'Linux',
        ssh_user: '',
        password: '',
        description: '',
        project_id: null,
        ssh_key: '',
        region: '',
        provider: '',
        tags: '',
        status: 'running',
        server_start_date: '',
        server_end_date: '',
        server_is_permanent: false,
        server_enable_expiry_alert: true,
        server_expiry_alert_days: 30,
      });
      setDbForm({
        title: '',
        db_type: 'MySQL',
        host: '',
        port: 3306,
        database: '',
        username: '',
        password: '',
        admin_url: '',
        description: '',
        project_id: null,
        service_start_date: '',
        service_end_date: '',
        service_is_permanent: false,
        service_enable_expiry_alert: true,
        service_expiry_alert_days: 30,
      });
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (assetType === 'server') {
        if (!serverForm.title.trim() || !serverForm.ip.trim()) {
          setError(t('infrastructureModal.errors.serverRequired'));
          setIsLoading(false);
          return;
        }

        const notes = buildAssetNotes('server', {
          ip: serverForm.ip,
          port: serverForm.port,
          os: serverForm.os,
          ssh_user: serverForm.ssh_user,
          description: serverForm.description,
          // 扩展字段
          ssh_key: serverForm.ssh_key,
          region: serverForm.region,
          provider: serverForm.provider,
          tags: serverForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          status: serverForm.status,
          // 租期字段
          server_start_date: serverForm.server_start_date || undefined,
          server_end_date: serverForm.server_end_date || undefined,
          server_is_permanent: serverForm.server_is_permanent,
          server_enable_expiry_alert: serverForm.server_enable_expiry_alert,
          server_expiry_alert_days: serverForm.server_expiry_alert_days,
        });

        const itemData = {
          title: serverForm.title.trim(),
          secret_encrypted: serverForm.password,
          category: 'Server',
          notes,
          project_id: serverForm.project_id,
          color: '#3b82f6',
          is_archived: false,
        };

        if (item?.id) {
          await api.updateVaultItem(item.id, { ...itemData, id: item.id });
        } else {
          await api.createVaultItem(itemData);
        }
      } else {
        if (!dbForm.title.trim() || !dbForm.host.trim() || !dbForm.database.trim()) {
          setError(t('infrastructureModal.errors.databaseRequired'));
          setIsLoading(false);
          return;
        }

        const notes = buildAssetNotes('database', {
          db_type: dbForm.db_type,
          host: dbForm.host,
          port: dbForm.port,
          database: dbForm.database,
          username: dbForm.username,
          admin_url: dbForm.admin_url,
          description: dbForm.description,
          // 租期字段
          service_start_date: dbForm.service_start_date || undefined,
          service_end_date: dbForm.service_end_date || undefined,
          service_is_permanent: dbForm.service_is_permanent,
          service_enable_expiry_alert: dbForm.service_enable_expiry_alert,
          service_expiry_alert_days: dbForm.service_expiry_alert_days,
        });

        const itemData = {
          title: dbForm.title.trim(),
          secret_encrypted: dbForm.password,
          category: 'Database',
          notes,
          project_id: dbForm.project_id,
          color: '#10b981',
          is_archived: false,
        };

        if (item?.id) {
          await api.updateVaultItem(item.id, { ...itemData, id: item.id });
        } else {
          await api.createVaultItem(itemData);
        }
      }

      await refreshData();
      onClose();
    } catch (err) {
      setError(item?.id ? t('infrastructureModal.errors.updateFailed') : t('infrastructureModal.errors.createFailed'));
      console.error('Failed to save infrastructure:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface2">
          <h2 className="text-xl font-bold text-text">
            {item ? t('infrastructureModal.title.edit') : t('infrastructureModal.title.new')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface2 rounded transition-colors"
          >
            <X className="w-5 h-5 text-text2" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-error bg-opacity-20 border border-error text-error p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Asset Type Selection (only for new items) */}
          {!item && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.assetType')}</label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setAssetType('server')}
                  className={`flex-1 flex items-center justify-center space-x-2 p-4 rounded-lg border-2 transition-colors ${
                    assetType === 'server'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface2 hover:border-surface'
                  }`}
                >
                  <Server className="w-5 h-5" />
                  <span>{t('infrastructureModal.types.server')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssetType('database')}
                  className={`flex-1 flex items-center justify-center space-x-2 p-4 rounded-lg border-2 transition-colors ${
                    assetType === 'database'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface2 hover:border-surface'
                  }`}
                >
                  <Database className="w-5 h-5" />
                  <span>{t('infrastructureModal.types.database')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              {t('infrastructureModal.form.name')} *
            </label>
            <input
              type="text"
              value={assetType === 'server' ? serverForm.title : dbForm.title}
              onChange={(e) => {
                if (assetType === 'server') {
                  setServerForm(prev => ({ ...prev, title: e.target.value }));
                } else {
                  setDbForm(prev => ({ ...prev, title: e.target.value }));
                }
              }}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
              placeholder={assetType === 'server' ? t('infrastructureModal.form.namePlaceholderServer') : t('infrastructureModal.form.namePlaceholderDatabase')}
            />
          </div>

          {/* Server Fields */}
          {assetType === 'server' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.ipAddress')} *</label>
                  <input
                    type="text"
                    value={serverForm.ip}
                    onChange={(e) => setServerForm(prev => ({ ...prev, ip: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.port')}</label>
                  <input
                    type="number"
                    value={serverForm.port}
                    onChange={(e) => setServerForm(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.os')}</label>
                  <select
                    value={serverForm.os}
                    onChange={(e) => setServerForm(prev => ({ ...prev, os: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="Linux">Linux</option>
                    <option value="Windows">Windows</option>
                    <option value="macOS">macOS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.sshUser')}</label>
                  <input
                    type="text"
                    value={serverForm.ssh_user}
                    onChange={(e) => setServerForm(prev => ({ ...prev, ssh_user: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="root"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.password')}</label>
                <input
                  type="password"
                  value={serverForm.password}
                  onChange={(e) => setServerForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder={t('infrastructureModal.form.sshPassword')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.description')}</label>
                <textarea
                  value={serverForm.description}
                  onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
                  placeholder={t('infrastructureModal.form.serverDescription')}
                />
              </div>

              {/* 扩展字段区域 */}
              <div className="border-t border-surface2 pt-4 mt-4">
                <h4 className="text-sm font-medium text-text mb-3">{t('infrastructureModal.form.advancedConfig')}</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.region')}</label>
                    <input
                      type="text"
                      value={serverForm.region}
                      onChange={(e) => setServerForm(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                      placeholder={t('infrastructureModal.form.regionPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.provider')}</label>
                    <select
                      value={serverForm.provider}
                      onChange={(e) => setServerForm(prev => ({ ...prev, provider: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    >
                      <option value="">{t('infrastructureModal.form.providerSelect')}</option>
                      <option value="aliyun">{t('infrastructureModal.providers.aliyun')}</option>
                      <option value="tencent">{t('infrastructureModal.providers.tencent')}</option>
                      <option value="AWS">AWS</option>
                      <option value="Azure">Azure</option>
                      <option value="huawei">{t('infrastructureModal.providers.huawei')}</option>
                      <option value="selfhosted">{t('infrastructureModal.providers.selfhosted')}</option>
                      <option value="other">{t('infrastructureModal.providers.other')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.status')}</label>
                    <select
                      value={serverForm.status}
                      onChange={(e) => setServerForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    >
                      <option value="running">{t('infrastructureModal.status.running')}</option>
                      <option value="stopped">{t('infrastructureModal.status.stopped')}</option>
                      <option value="maintenance">{t('infrastructureModal.status.maintenance')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.tags')}</label>
                    <input
                      type="text"
                      value={serverForm.tags}
                      onChange={(e) => setServerForm(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                      placeholder={t('infrastructureModal.form.tagsPlaceholder')}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.sshKey')}</label>
                  <textarea
                    value={serverForm.ssh_key}
                    onChange={(e) => setServerForm(prev => ({ ...prev, ssh_key: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none font-mono text-xs"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                  />
                </div>

                {/* 服务器租期设置 */}
                <div className="mt-6 pt-6 border-t border-surface2">
                  <h4 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-accent rounded"></span>
                    {t('infrastructureModal.form.leaseSettings')}
                  </h4>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serverForm.server_is_permanent}
                        onChange={(e) => setServerForm(prev => ({ ...prev, server_is_permanent: e.target.checked }))}
                        className="w-4 h-4 rounded border-surface2 text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-text">{t('infrastructureModal.form.permanentUse')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serverForm.server_enable_expiry_alert}
                        onChange={(e) => setServerForm(prev => ({ ...prev, server_enable_expiry_alert: e.target.checked }))}
                        className="w-4 h-4 rounded border-surface2 text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-text">{t('infrastructureModal.form.enableExpiryAlert')}</span>
                    </label>
                  </div>

                  {!serverForm.server_is_permanent && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.startDate')}</label>
                        <input
                          type="date"
                          value={serverForm.server_start_date}
                          onChange={(e) => setServerForm(prev => ({ ...prev, server_start_date: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.endDate')}</label>
                        <input
                          type="date"
                          value={serverForm.server_end_date}
                          onChange={(e) => setServerForm(prev => ({ ...prev, server_end_date: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.alertDays')}</label>
                        <input
                          type="number"
                          value={serverForm.server_expiry_alert_days}
                          onChange={(e) => setServerForm(prev => ({ ...prev, server_expiry_alert_days: parseInt(e.target.value) || 30 }))}
                          min={1}
                          max={365}
                          className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Database Fields */}
          {assetType === 'database' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.dbType')}</label>
                  <select
                    value={dbForm.db_type}
                    onChange={(e) => setDbForm(prev => ({ ...prev, db_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="MySQL">MySQL</option>
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="MongoDB">MongoDB</option>
                    <option value="Redis">Redis</option>
                    <option value="SQLite">SQLite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.port')}</label>
                  <input
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => setDbForm(prev => ({ ...prev, port: parseInt(e.target.value) || 3306 }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.host')} *</label>
                  <input
                    type="text"
                    value={dbForm.host}
                    onChange={(e) => setDbForm(prev => ({ ...prev, host: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.databaseName')} *</label>
                  <input
                    type="text"
                    value={dbForm.database}
                    onChange={(e) => setDbForm(prev => ({ ...prev, database: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="mydb"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.username')}</label>
                <input
                  type="text"
                  value={dbForm.username}
                  onChange={(e) => setDbForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="root"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.dbPassword')}</label>
                <input
                  type="password"
                  value={dbForm.password}
                  onChange={(e) => setDbForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder={t('infrastructureModal.form.dbPasswordPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('infrastructureModal.form.adminUrl')}
                  {dbForm.admin_url && (
                    <span className="text-xs text-text2 ml-2 font-normal">
                      {adminUrlManuallyEdited.current ? t('infrastructureModal.form.manualInput') : t('infrastructureModal.form.autoGenerate')}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={dbForm.admin_url}
                  onChange={(e) => handleAdminUrlChange(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="https://phpmyadmin.example.com"
                />
                <p className="text-xs text-text2 mt-1">
                  {t('infrastructureModal.form.autoGenerateHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.description')}</label>
                <textarea
                  value={dbForm.description}
                  onChange={(e) => setDbForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
                  placeholder={t('infrastructureModal.form.dbDescription')}
                />
              </div>

              {/* 数据库服务租期设置 */}
              <div className="mt-6 pt-6 border-t border-surface2">
                <h4 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-accent rounded"></span>
                  {t('infrastructureModal.form.serviceLease')}
                </h4>
                
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dbForm.service_is_permanent}
                      onChange={(e) => setDbForm(prev => ({ ...prev, service_is_permanent: e.target.checked }))}
                      className="w-4 h-4 rounded border-surface2 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-text">{t('infrastructureModal.form.permanentUse')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dbForm.service_enable_expiry_alert}
                      onChange={(e) => setDbForm(prev => ({ ...prev, service_enable_expiry_alert: e.target.checked }))}
                      className="w-4 h-4 rounded border-surface2 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-text">{t('infrastructureModal.form.enableExpiryAlert')}</span>
                  </label>
                </div>

                {!dbForm.service_is_permanent && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.startDate')}</label>
                      <input
                        type="date"
                        value={dbForm.service_start_date}
                        onChange={(e) => setDbForm(prev => ({ ...prev, service_start_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.endDate')}</label>
                      <input
                        type="date"
                        value={dbForm.service_end_date}
                        onChange={(e) => setDbForm(prev => ({ ...prev, service_end_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.alertDays')}</label>
                      <input
                        type="number"
                        value={dbForm.service_expiry_alert_days}
                        onChange={(e) => setDbForm(prev => ({ ...prev, service_expiry_alert_days: parseInt(e.target.value) || 30 }))}
                        min={1}
                        max={365}
                        className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">{t('infrastructureModal.form.relatedProject')}</label>
            <select
              value={assetType === 'server' ? serverForm.project_id || '' : dbForm.project_id || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                if (assetType === 'server') {
                  setServerForm(prev => ({ ...prev, project_id: value }));
                } else {
                  setDbForm(prev => ({ ...prev, project_id: value }));
                }
              }}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
            >
              <option value="">{t('infrastructureModal.form.selectProject')}</option>
              {state.projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-surface2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface2 hover:bg-surface rounded-lg transition-colors"
              disabled={isLoading}
            >
              {t('infrastructureModal.form.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              {isLoading ? t('infrastructureModal.form.saving') : (item ? t('infrastructureModal.form.save') : t('infrastructureModal.form.create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
