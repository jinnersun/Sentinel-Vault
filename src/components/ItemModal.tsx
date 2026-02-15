import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X } from 'lucide-react';
import api from '../lib/tauri-api';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // For editing existing item
}

export default function ItemModal({ isOpen, onClose, item }: ItemModalProps) {
  const { state, refreshData } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    secret: '',
    url: '',
    notes: '',
    category: 'API',
    project_id: null as number | null,
    color: '#3b82f6',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        // Editing mode - populate form
        setFormData({
          title: item.title,
          secret: item.secret_encrypted || '',
          url: item.url || '',
          notes: item.notes || '',
          category: item.category,
          project_id: item.project_id || null,
          color: item.color,
        });
      } else {
        // New item mode - reset form and check clipboard
        setFormData({
          title: '',
          secret: '',
          url: '',
          notes: '',
          category: 'API',
          project_id: null,
          color: '#3b82f6',
        });
        setError('');
        checkClipboard();
      }
    }
  }, [item, isOpen]);

  useEffect(() => {
    // Auto-fetch favicon when URL changes
    if (formData.url) {
      fetchFavicon(formData.url);
    }
  }, [formData.url]);

  const fetchFavicon = async (url: string) => {
    try {
      const faviconUrl = await api.fetchFavicon(url);
      // In a real implementation, we would store this faviconUrl
      console.log('Favicon URL:', faviconUrl);
    } catch (error) {
      console.error('Failed to fetch favicon:', error);
    }
  };

  const checkClipboard = async () => {
    try {
      // In a real implementation, we would check clipboard content here
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text && text.length > 20 && /[A-Za-z0-9+_\-]/.test(text)) {
          if (window.confirm('检测到剪贴板中可能有API Key，是否自动填入？')) {
            setFormData(prev => ({ ...prev, secret: text }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to check clipboard:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate required fields
    if (!formData.title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!formData.secret.trim()) {
      setError('请输入API Key');
      return;
    }

    setIsLoading(true);

    try {
      const itemData = {
        title: formData.title.trim(),
        secret_encrypted: formData.secret.trim(), // Secret is stored as secret_encrypted
        url: formData.url?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        category: formData.category,
        project_id: formData.project_id,
        color: formData.color,
        favicon_url: undefined,
        is_archived: false,
      };

      if (item) {
        // Update existing item
        try {
          await api.updateVaultItem(item.id!, {
            ...item,
            ...itemData,
            id: item.id!,
          });
          console.log('Item updated successfully');
        } catch (updateError) {
          console.error('Update error:', updateError);
          setError(`更新失败: ${String(updateError)}`);
          return;
        }
      } else {
        // Create new item
        try {
          const newItemId = await api.createVaultItem(itemData);
          console.log('Item created successfully with ID:', newItemId);
        } catch (createError) {
          console.error('Create error:', createError);
          setError(`创建失败: ${String(createError)}`);
          return;
        }
      }

      // Refresh data after successful operation
      try {
        await refreshData();
      } catch (refreshError) {
        console.error('Refresh error:', refreshError);
        // Don't fail the operation if refresh fails
      }

      onClose();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`操作失败: ${errorMsg}`);
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface2">
          <h2 className="text-xl font-bold text-text">
            {item ? '编辑条目' : '新建条目'}
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
            <div className="bg-error bg-opacity-20 border border-error text-error p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              标题 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="input"
              placeholder="例如：OpenAI API Key"
              required
            />
          </div>

          {/* Secret */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              API Key *
            </label>
            <textarea
              value={formData.secret}
              onChange={(e) => handleInputChange('secret', e.target.value)}
              className="input min-h-[80px]"
              placeholder="输入您的API Key..."
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="input"
              placeholder="https://api.openai.com"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              分类
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="input"
            >
              <option value="API">API</option>
              <option value="Database">数据库</option>
              <option value="Service">服务</option>
              <option value="Other">其他</option>
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              项目
            </label>
            <select
              value={formData.project_id || ''}
              onChange={(e) => handleInputChange('project_id', e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">无项目</option>
              {state.projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              颜色标识
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="w-12 h-8 border border-surface2 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="input flex-1"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              备注
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="input min-h-[120px]"
              placeholder="添加备注信息..."
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn flex-1 disabled:opacity-50"
            >
              {isLoading ? '保存中...' : item ? '更新' : '创建'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}