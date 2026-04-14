import { useEffect, useState } from 'react';
import api from '../lib/tauri-api';
import { Trash2, Edit2, Plus, Copy, Eye, EyeOff } from 'lucide-react';
import type { ApiKey } from '../types';
import { useTranslation } from 'react-i18next';

export default function ApiKeysView() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState({ name: '', key_value: '', scope: '' });
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);

  const loadApiKeys = async () => {
    try {
      const data = await api.getApiKeys();
      setApiKeys(data);
    } catch (e) {
      console.error('Failed to load API keys', e);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.name.trim() || !newKey.key_value.trim()) return;

    try {
      await api.createApiKey({
        name: newKey.name.trim(),
        key_value: newKey.key_value.trim(),
        scope: newKey.scope.trim() || undefined,
      });
      setNewKey({ name: '', key_value: '', scope: '' });
      setShowNewKey(false);
      await loadApiKeys();
    } catch (e) {
      console.error('Failed to create API key', e);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey?.id || !editingKey.name.trim() || !editingKey.key_value.trim()) return;

    try {
      await api.updateApiKey(editingKey.id, {
        name: editingKey.name.trim(),
        key_value: editingKey.key_value.trim(),
        scope: editingKey.scope?.trim() || undefined,
      });
      setEditingKey(null);
      await loadApiKeys();
    } catch (e) {
      console.error('Failed to update API key', e);
    }
  };

  // 修复：改进的删除逻辑
  const handleDelete = async (id: number) => {
    // 检查是否已在删除中（防止多次点击）
    if (deletingKeyId !== null) {
      return;
    }

    if (!window.confirm(t('apikeys.deleteConfirm'))) {
      return;
    }

    setDeletingKeyId(id);

    try {
      // 关键修改：先调用后端 API，不做乐观更新
      await api.deleteApiKey(id);
      
      // 只有后端成功返回，才更新本地状态
      setApiKeys(prev => prev.filter(k => k.id !== id));
      
      console.log(t('apikeys.deleteSuccess'));
    } catch (e) {
      console.error('删除失败', e);
      alert(t('apikeys.deleteFailed', { error: e instanceof Error ? e.message : t('common.unknownError') }));
      // 失败时刷新，用来恢复数据
      await loadApiKeys();
    } finally {
      setDeletingKeyId(null);
    }
  };

  const toggleKeyVisibility = (id: number) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t('apikeys.title')}</h2>
        <button
          onClick={() => setShowNewKey(true)}
          className="btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('apikeys.new')}
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 text-text2">
          <div className="text-6xl mb-4">🔑</div>
          <p>{t('apikeys.empty')}</p>
          <p className="text-sm mt-2">{t('apikeys.addNew')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center p-4 border rounded-lg bg-surface"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{key.name}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-sm bg-surface2 px-2 py-1 rounded">
                    {visibleKeys.has(key.id!) ? key.key_value : maskKey(key.key_value)}
                  </code>
                  <button
                    onClick={() => toggleKeyVisibility(key.id!)}
                    className="p-1 hover:bg-surface2 rounded"
                  >
                    {visibleKeys.has(key.id!) ? (
                      <EyeOff className="w-4 h-4 text-text2" />
                    ) : (
                      <Eye className="w-4 h-4 text-text2" />
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(key.key_value)}
                    className="p-1 hover:bg-surface2 rounded"
                    title={t('common.copy')}
                  >
                    <Copy className="w-4 h-4 text-text2" />
                  </button>
                </div>
                {key.scope && (
                  <div className="text-xs text-text2 mt-1">
                    {t('apikeys.scope')}: {key.scope}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setEditingKey(key)}
                  className="p-2 hover:bg-surface2 rounded text-text2"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => key.id && handleDelete(key.id)}
                  className="p-2 hover:bg-surface2 rounded text-text2 hover:text-error"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New API Key Modal */}
      {showNewKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">{t('apikeys.new')}</h3>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.name')}</label>
                  <input
                    type="text"
                    value={newKey.name}
                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.namePlaceholder')}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.keyValue')}</label>
                  <input
                    type="text"
                    value={newKey.key_value}
                    onChange={(e) => setNewKey({ ...newKey, key_value: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.keyValuePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.scope')}</label>
                  <input
                    type="text"
                    value={newKey.scope}
                    onChange={(e) => setNewKey({ ...newKey, scope: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.scopePlaceholder')}
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-6">
                <button type="submit" className="btn flex-1">
                  {t('common.create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewKey(false);
                    setNewKey({ name: '', key_value: '', scope: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit API Key Modal */}
      {editingKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">{t('apikeys.editApiKey', '编辑 API Key')}</h3>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.name')}</label>
                  <input
                    type="text"
                    value={editingKey.name}
                    onChange={(e) => setEditingKey({ ...editingKey, name: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.keyValue')}</label>
                  <input
                    type="text"
                    value={editingKey.key_value}
                    onChange={(e) => setEditingKey({ ...editingKey, key_value: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.keyValuePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">{t('apikeys.form.scope')}</label>
                  <input
                    type="text"
                    value={editingKey.scope || ''}
                    onChange={(e) => setEditingKey({ ...editingKey, scope: e.target.value })}
                    className="input w-full"
                    placeholder={t('apikeys.form.scopePlaceholder')}
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-6">
                <button type="submit" className="btn flex-1">
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="btn-secondary flex-1"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
