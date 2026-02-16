import { useEffect, useState } from 'react';
import api from '../lib/tauri-api';
import { Trash2, Edit2, Plus, Copy, Eye, EyeOff } from 'lucide-react';
import type { ApiKey } from '../types';

export default function ApiKeysView() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState({ name: '', key_value: '', scope: '' });
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());

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

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return;

    try {
      await api.deleteApiKey(id);
      await loadApiKeys();
    } catch (e) {
      console.error('Failed to delete API key', e);
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
        <h2 className="text-xl font-semibold">API Keys</h2>
        <button
          onClick={() => setShowNewKey(true)}
          className="btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建 API Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 text-text2">
          <div className="text-6xl mb-4">🔑</div>
          <p>暂无 API Keys</p>
          <p className="text-sm mt-2">点击上方按钮添加新的 API Key</p>
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
                    title="复制"
                  >
                    <Copy className="w-4 h-4 text-text2" />
                  </button>
                </div>
                {key.scope && (
                  <div className="text-xs text-text2 mt-1">
                    作用域: {key.scope}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setEditingKey(key)}
                  className="p-2 hover:bg-surface2 rounded text-text2"
                  title="编辑"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => key.id && handleDelete(key.id)}
                  className="p-2 hover:bg-surface2 rounded text-text2 hover:text-error"
                  title="删除"
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
            <h3 className="text-lg font-semibold mb-4">新建 API Key</h3>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text2 mb-1">名称</label>
                  <input
                    type="text"
                    value={newKey.name}
                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    className="input w-full"
                    placeholder="例如: Aliyun Access Key"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">Key Value</label>
                  <input
                    type="text"
                    value={newKey.key_value}
                    onChange={(e) => setNewKey({ ...newKey, key_value: e.target.value })}
                    className="input w-full"
                    placeholder="输入 API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">作用域 (可选)</label>
                  <input
                    type="text"
                    value={newKey.scope}
                    onChange={(e) => setNewKey({ ...newKey, scope: e.target.value })}
                    className="input w-full"
                    placeholder="例如: production, readonly"
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-6">
                <button type="submit" className="btn flex-1">
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewKey(false);
                    setNewKey({ name: '', key_value: '', scope: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  取消
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
            <h3 className="text-lg font-semibold mb-4">编辑 API Key</h3>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text2 mb-1">名称</label>
                  <input
                    type="text"
                    value={editingKey.name}
                    onChange={(e) => setEditingKey({ ...editingKey, name: e.target.value })}
                    className="input w-full"
                    placeholder="例如: Aliyun Access Key"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">Key Value</label>
                  <input
                    type="text"
                    value={editingKey.key_value}
                    onChange={(e) => setEditingKey({ ...editingKey, key_value: e.target.value })}
                    className="input w-full"
                    placeholder="输入 API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text2 mb-1">作用域 (可选)</label>
                  <input
                    type="text"
                    value={editingKey.scope || ''}
                    onChange={(e) => setEditingKey({ ...editingKey, scope: e.target.value })}
                    className="input w-full"
                    placeholder="例如: production, readonly"
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-6">
                <button type="submit" className="btn flex-1">
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
