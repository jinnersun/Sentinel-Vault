import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X } from 'lucide-react';
import api from '../lib/tauri-api';
import { showUnsavedDialog } from '../hooks/useUnsavedChanges';
import { useTranslation } from 'react-i18next';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // For editing existing item
  defaultCategory?: string; // 新建时的默认分类
}

export default function ItemModal({ isOpen, onClose, item, defaultCategory }: ItemModalProps) {
  const { t } = useTranslation();
  const { state, refreshData } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    secret: '',
    url: '',
    notes: '',
    category: defaultCategory || 'API',
    project_id: null as number | null,
    color: '#3b82f6',
  });
  // Chrome 凭证专用字段
  const [chromeUsername, setChromeUsername] = useState('');
  const [originalData, setOriginalData] = useState(formData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isDirtyRef = useRef(false);
  const { dispatch } = useApp();

  // 检查是否有未保存的更改
  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);
  isDirtyRef.current = isDirty;

  // 页面关闭前的提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 同步未保存状态和保存回调到全局
  useEffect(() => {
    dispatch({ type: 'SET_UNSAVED_CHANGES', payload: isOpen && isDirty });
    dispatch({ 
      type: 'SET_SAVE_CALLBACK', 
      payload: isOpen && isDirty ? () => handleSubmit(new Event('submit') as any) : null 
    });
    return () => {
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      dispatch({ type: 'SET_SAVE_CALLBACK', payload: null });
    };
  }, [isOpen, isDirty, dispatch]);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        // Editing mode - populate form
        const data = {
          title: item.title,
          secret: item.secret_encrypted || '',
          url: item.url || '',
          notes: item.notes || '',
          category: item.category,
          project_id: item.project_id || null,
          color: item.color,
        };
        setFormData(data);
        setOriginalData(data);
        // 提取 Chrome 凭证的用户名
        if (item.category === 'Chrome' && item.notes) {
          const usernameMatch = item.notes.match(/用户名: (.+)/);
          setChromeUsername(usernameMatch ? usernameMatch[1] : '');
        } else {
          setChromeUsername('');
        }
      } else {
        // New item mode - reset form and check clipboard
        const category = defaultCategory || 'API';
        const data = {
          title: '',
          secret: '',
          url: '',
          notes: '',
          category,
          project_id: null,
          color: category === 'Chrome' ? '#3b82f6' : '#3b82f6',
        };
        setFormData(data);
        setOriginalData(data);
        setChromeUsername('');
        setError('');
        if (category !== 'Chrome') {
          checkClipboard();
        }
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
          if (window.confirm(t('itemModal.pasteConfirm'))) {
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
      setError(t('itemModal.errors.titleRequired'));
      return;
    }
    if (!formData.secret.trim()) {
      setError(formData.category === 'Chrome' ? t('itemModal.errors.secretRequired', { type: '密码' }) : t('itemModal.errors.secretRequired', { type: 'API Key' }));
      return;
    }
    if (formData.category === 'Chrome' && !formData.url.trim()) {
      setError(t('itemModal.errors.urlRequired'));
      return;
    }

    setIsLoading(true);

    try {
      // 构建 notes 字段
      let notes = formData.notes?.trim() || '';
      if (formData.category === 'Chrome' && chromeUsername) {
        notes = `${t('itemModal.chromeUsername')}: ${chromeUsername}\n${notes}`;
      }

      const itemData = {
        title: formData.title.trim(),
        secret_encrypted: formData.secret.trim(), // Secret is stored as secret_encrypted
        url: formData.url?.trim() || undefined,
        notes: notes || undefined,
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
          setError(t('itemModal.errors.updateFailed', { error: String(updateError) }));
          return;
        }
      } else {
        // Create new item
        try {
          const newItemId = await api.createVaultItem(itemData);
          console.log('Item created successfully with ID:', newItemId);
        } catch (createError) {
          console.error('Create error:', createError);
          setError(t('itemModal.errors.createFailed', { error: String(createError) }));
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

      // 更新原始数据，标记为已保存
      setOriginalData(formData);
      onClose();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(t('itemModal.errors.operationFailed', { error: errorMsg }));
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = async () => {
    if (isDirty) {
      const action = await showUnsavedDialog(t('itemModal.unsavedChanges'));
      if (action === 'cancel') return;
      if (action === 'save') {
        // 触发保存
        const form = document.querySelector('form') as HTMLFormElement;
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
        return;
      }
      // action === 'discard'，继续关闭
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface2">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-text">
              {item ? t('itemModal.title.edit') : t('itemModal.title.new')}
            </h2>
            {isDirty && (
              <span className="text-sm text-warning">{t('itemModal.unsavedIndicator')}</span>
            )}
          </div>
          <button
            onClick={handleClose}
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
              {t('itemModal.form.title')} *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="input"
              placeholder={t('itemModal.form.titlePlaceholder')}
              required
            />
          </div>

          {/* Chrome 凭证专用字段 */}
          {formData.category === 'Chrome' ? (
            <>
              {/* URL - Chrome 必填 */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('itemModal.form.websiteUrl')} *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  className="input"
                  placeholder="https://example.com"
                  required
                />
              </div>

              {/* 用户名 - Chrome */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('itemModal.form.username')}
                </label>
                <input
                  type="text"
                  value={chromeUsername}
                  onChange={(e) => setChromeUsername(e.target.value)}
                  className="input"
                  placeholder="user@example.com"
                />
              </div>

              {/* 密码 - Chrome */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('itemModal.form.password')} *
                </label>
                <input
                  type="password"
                  value={formData.secret}
                  onChange={(e) => handleInputChange('secret', e.target.value)}
                  className="input"
                  placeholder={t('itemModal.form.passwordPlaceholder')}
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* Secret - 普通 API Key */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('itemModal.form.apiKey')} *
                </label>
                <textarea
                  value={formData.secret}
                  onChange={(e) => handleInputChange('secret', e.target.value)}
                  className="input min-h-[80px]"
                  placeholder={t('itemModal.form.apiKeyPlaceholder')}
                  required
                />
              </div>

              {/* URL - 普通 */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('itemModal.form.url')}
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  className="input"
                  placeholder="https://api.openai.com"
                />
              </div>
            </>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              {t('itemModal.form.category')}
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="input"
            >
              <option value="API">API</option>
              <option value="Database">{t('itemModal.categories.database')}</option>
              <option value="Service">{t('itemModal.categories.service')}</option>
              <option value="Other">{t('itemModal.categories.other')}</option>
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              {t('itemModal.form.project')}
            </label>
            <select
              value={formData.project_id || ''}
              onChange={(e) => handleInputChange('project_id', e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">{t('itemModal.form.noProject')}</option>
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
              {t('itemModal.form.colorIndicator')}
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
              {t('itemModal.form.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="input min-h-[120px]"
              placeholder={t('itemModal.form.notesPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn flex-1 disabled:opacity-50"
            >
              {isLoading ? t('itemModal.form.saving') : item ? t('itemModal.form.update') : t('itemModal.form.create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              {t('itemModal.form.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}