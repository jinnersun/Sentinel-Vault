import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Copy, Edit, Trash2, Plus } from 'lucide-react';
import api from '../lib/tauri-api';
import { smartCopy } from '../lib/smart-copy';
import { showUnsavedDialog } from '../hooks/useUnsavedChanges';
import { useTranslation } from 'react-i18next';

export default function VaultList({ onEditItem }: { onEditItem: (item: any) => void }) {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();
  // 记录正在删除的项目 ID，避免多次点击
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  // 检查未保存更改并执行操作
  const checkUnsavedAndExecute = async (action: () => void) => {
    if (state.hasUnsavedChanges) {
      const result = await showUnsavedDialog(t('sidebar.unsavedChanges'));
      if (result === 'cancel') return;
      if (result === 'save') {
        // 用户选择保存，执行保存回调
        if (state.saveCallback) {
          try {
            await state.saveCallback();
          } catch (error) {
            console.error('保存失败:', error);
            alert(t('sidebar.saveFailed'));
            return;
          }
        }
        // 保存成功后继续执行跳转
      }
      // result === 'discard' 或保存成功，继续执行
    }
    action();
  };

  const handleCopy = async (item: any, format: 'raw' | 'env' | 'json' = 'raw') => {
    try {
      // In a real implementation, we would decrypt the secret first
      const secret = item.secret_encrypted; // Replace with decrypted secret
      
      await smartCopy.copyText(secret, { type: format });
      
      // Visual feedback
      const buttonId = `copy-${format}-${item.id}`;
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('text-success');
        setTimeout(() => {
          button.classList.remove('text-success');
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // 修复：改进的删除逻辑
  const handleDelete = async (e: React.MouseEvent, item: any) => {
    // 1. 必须优先切断冒泡，防止触发父级的 onClick 选中逻辑
    e.preventDefault();
    e.stopPropagation();

    // 修复：检查是否已在删除中（防止多次点击）
    if (deletingItemId !== null) {
      return;
    }

    // 2. 使用异步确认对话框，确保UI不会提前更新
    const confirmed = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm(t('vault.deleteConfirm', { title: item.title }));
        resolve(result);
      }, 0);
    });

    if (!confirmed) {
      return;
    }

    setDeletingItemId(item.id);

    try {
      // 关键修改：先调用后端 API，不做乐观更新
      // 这样即使用户等待确认，UI 也不会瞬间消失
      await api.deleteVaultItem(item.id!);
      
      // 只有后端成功返回，才更新本地 Redux 状态
      dispatch({ type: 'DELETE_VAULT_ITEM', payload: item.id });
      
      // 如果当前选中的就是这个项，才清除选中
      if (state.selectedItem?.id === item.id) {
        dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
      }
      
      console.log(t('vault.deleteSuccess', { title: item.title }));
      
    } catch (error) {
      console.error('删除失败:', error);
      alert(t('vault.deleteFailed', { title: item.title, error: error instanceof Error ? error.message : t('common.unknownError') }));
      // 失败时不需要调用 refreshData，因为我们从未修改本地状态
      
    } finally {
      setDeletingItemId(null);
    }
  };

  // 计算 Chrome 凭证数量
  const chromeCount = state.vaultItems.filter(item => item.category === 'Chrome').length;

  // 过滤逻辑：根据 selectedCategory 和 searchQuery
  const filteredItems = state.vaultItems.filter(item => {
    // 如果有搜索词，显示所有匹配结果（不过滤分类）
    if (state.searchQuery) {
      return true; // 后端已经过滤过了，直接显示
    }
    
    // 1. 按分类过滤
    if (state.selectedCategory) {
      // 特定分类：严格匹配
      if (item.category !== state.selectedCategory) {
        return false;
      }
    } else {
      // "全部条目"：排除 Chrome 和 API 分类（只显示普通凭证）
      if (item.category === 'Chrome' || item.category === 'API') {
        return false;
      }
    }
    return true;
  });

  const displayText = (text: string, stealthMode: boolean) => {
    if (!stealthMode) return text;
    return '*'.repeat(Math.min(text.length, 8));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-surface2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-text">
              {state.selectedProject
                ? state.projects.find(p => p.id === state.selectedProject)?.name || t('vault.defaultProject')
                : t('vault.allItems', '全部条目')}
            </h2>
            {chromeCount > 0 && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                Chrome: {chromeCount}
              </span>
            )}
          </div>
          <button
            onClick={() => onEditItem(null)} // null indicates new item
            className="p-1 hover:bg-surface2 rounded transition-colors"
            title={t('toolbar.newItem', '新建条目')}
          >
            <Plus className="w-4 h-4 text-text2" />
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`card p-4 cursor-pointer transition-all relative ${
              state.selectedItem?.id === item.id
                ? 'ring-2 ring-accent'
                : 'hover:bg-surface'
            }`}
            onClick={() => checkUnsavedAndExecute(() => dispatch({ type: 'SET_SELECTED_ITEM', payload: item }))}
          >
            {/* Color Bar */}
            <div
              className="color-bar"
              style={{ backgroundColor: item.color }}
            ></div>

            {/* Content */}
            <div className="ml-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {item.favicon_url && (
                    <img
                      src={item.favicon_url}
                      alt=""
                      className="w-4 h-4 rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="font-medium text-text">
                    {displayText(item.title, state.stealthMode)}
                  </h3>
                </div>
                <span className="text-xs text-text2 bg-surface2 px-2 py-1 rounded">
                  {item.category}
                </span>
              </div>

              {/* URL */}
              {item.url && (
                <div className="text-sm text-text2 mb-2 truncate">
                  {displayText(item.url, state.stealthMode)}
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div className="text-sm text-text2 mb-3 line-clamp-2">
                  {displayText(item.notes, state.stealthMode)}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  id={`copy-raw-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(item, 'raw');
                  }}
                  className="p-1 hover:bg-surface2 rounded transition-colors text-text2 hover:text-accent"
                  title={t('common.copy')}
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  id={`copy-env-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(item, 'env');
                  }}
                  className="p-1 hover:bg-surface2 rounded transition-colors text-text2 hover:text-accent"
                  title={t('vault.copyAsEnv', '复制为环境变量')}
                >
                  <span className="text-xs font-mono">ENV</span>
                </button>
                <button
                  id={`copy-json-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(item, 'json');
                  }}
                  className="p-1 hover:bg-surface2 rounded transition-colors text-text2 hover:text-accent"
                  title={t('vault.copyAsJson', '复制为JSON')}
                >
                  <span className="text-xs font-mono">{`{}`}</span>
                </button>
                <div className="flex-1"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditItem(item);
              }}
              className="p-1 hover:bg-surface2 rounded transition-colors text-text2 hover:text-warning"
              title={t('common.edit')}
            >
              <Edit className="w-3 h-3" />
            </button>
                <button
                  onClick={(e) => {
                    handleDelete(e, item);
                  }}
                  className="p-1 hover:bg-surface2 rounded transition-colors text-text2 hover:text-error"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 opacity-50">🔑</div>
            <p className="text-text2">
              {state.searchQuery ? t('vault.noMatch', '没有找到匹配的条目') : t('vault.noItems', '还没有任何条目')}
            </p>
            <button
              onClick={() => onEditItem(null)} // null indicates new item
              className="btn btn-sm mt-4"
            >
              {t('vault.createFirst', '创建第一个条目')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}