import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Server, Database } from 'lucide-react';
import api from '../lib/tauri-api';
import { buildAssetNotes } from '../types';

interface InfrastructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // For editing existing item
}

export default function InfrastructureModal({ isOpen, onClose, item }: InfrastructureModalProps) {
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
  });

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
          setError('名称和 IP 地址不能为空');
          setIsLoading(false);
          return;
        }

        const notes = buildAssetNotes('server', {
          ip: serverForm.ip,
          port: serverForm.port,
          os: serverForm.os,
          ssh_user: serverForm.ssh_user,
          description: serverForm.description,
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
          setError('名称、Host 和数据库名不能为空');
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
      setError(item?.id ? '更新失败' : '创建失败');
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
            {item ? '编辑资产' : '新建基础设施资产'}
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
              <label className="block text-sm font-medium text-text mb-2">资产类型</label>
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
                  <span>服务器</span>
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
                  <span>数据库</span>
                </button>
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              名称 *
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
              placeholder={assetType === 'server' ? '例如：生产服务器-01' : '例如：主数据库'}
            />
          </div>

          {/* Server Fields */}
          {assetType === 'server' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">IP 地址 *</label>
                  <input
                    type="text"
                    value={serverForm.ip}
                    onChange={(e) => setServerForm(prev => ({ ...prev, ip: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">端口</label>
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
                  <label className="block text-sm font-medium text-text mb-2">操作系统</label>
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
                  <label className="block text-sm font-medium text-text mb-2">SSH 用户</label>
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
                <label className="block text-sm font-medium text-text mb-2">密码</label>
                <input
                  type="password"
                  value={serverForm.password}
                  onChange={(e) => setServerForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="SSH 密码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">描述</label>
                <textarea
                  value={serverForm.description}
                  onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
                  placeholder="服务器用途描述..."
                />
              </div>
            </>
          )}

          {/* Database Fields */}
          {assetType === 'database' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">数据库类型</label>
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
                  <label className="block text-sm font-medium text-text mb-2">端口</label>
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
                  <label className="block text-sm font-medium text-text mb-2">Host *</label>
                  <input
                    type="text"
                    value={dbForm.host}
                    onChange={(e) => setDbForm(prev => ({ ...prev, host: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">数据库名 *</label>
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
                <label className="block text-sm font-medium text-text mb-2">用户名</label>
                <input
                  type="text"
                  value={dbForm.username}
                  onChange={(e) => setDbForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="root"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">密码</label>
                <input
                  type="password"
                  value={dbForm.password}
                  onChange={(e) => setDbForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="数据库密码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">管理后台 URL</label>
                <input
                  type="text"
                  value={dbForm.admin_url}
                  onChange={(e) => setDbForm(prev => ({ ...prev, admin_url: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="https://phpmyadmin.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">描述</label>
                <textarea
                  value={dbForm.description}
                  onChange={(e) => setDbForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
                  placeholder="数据库用途描述..."
                />
              </div>
            </>
          )}

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">关联项目（可选）</label>
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
              <option value="">-- 选择项目 --</option>
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
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              {isLoading ? '保存中...' : (item ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
