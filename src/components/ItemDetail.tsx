import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Copy, Edit, ExternalLink, Eye, EyeOff, History, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/tauri-api';
import { formatDate } from '../lib/utils';
import { smartCopy } from '../lib/smart-copy';

interface HistoryRecord {
  id: number;
  vault_id: number;
  old_secret_encrypted: string;
  change_reason: string | null;
  created_at: string;
}

export default function ItemDetail({ onEditItem }: { onEditItem: (item: any) => void }) {
  const { state, dispatch } = useApp();
  const [showSecret, setShowSecret] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  if (!state.selectedItem) {
    return null;
  }

  const handleCopy = async (format: 'raw' | 'env' | 'json' = 'raw') => {
    try {
      // In a real implementation, we would decrypt the secret first
      const secret = state.selectedItem!.secret_encrypted; // Replace with decrypted secret
      
      await smartCopy.copyText(secret, { type: format });
      
      // Visual feedback
      const buttonId = `detail-copy-${format}`;
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('bg-success');
        setTimeout(() => {
          button.classList.remove('bg-success');
        }, 500);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleEdit = () => {
    onEditItem(state.selectedItem);
  };

  const handleDelete = async () => {
    if (window.confirm(`确定要删除 "${state.selectedItem!.title}" 吗？`)) {
      try {
        await api.deleteVaultItem(state.selectedItem!.id!);
        dispatch({ type: 'DELETE_VAULT_ITEM', payload: state.selectedItem!.id! });
        dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const displaySecret = (text: string, show: boolean) => {
    if (!show) return '*'.repeat(Math.min(text.length, 20));
    return text;
  };

  const loadHistory = async () => {
    if (!state.selectedItem?.id) return;
    setLoadingHistory(true);
    try {
      const data = await api.getVaultHistory(state.selectedItem.id);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory && history.length === 0) {
      loadHistory();
    }
  }, [showHistory]);

  const project = state.projects.find(p => p.id === state.selectedItem?.project_id);

  return (
    <div className="h-full bg-surface flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-surface2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {state.selectedItem.favicon_url && (
              <img
                src={state.selectedItem.favicon_url}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <h2 className="text-xl font-bold text-text">
                {state.stealthMode ? displaySecret(state.selectedItem.title, false) : state.selectedItem.title}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-text2 bg-surface2 px-2 py-1 rounded">
                  {state.selectedItem.category}
                </span>
                {project && (
                  <span 
                    className="text-sm px-2 py-1 rounded text-white"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEdit}
              className="btn btn-sm"
              title="编辑"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="btn-secondary btn-sm text-error hover:bg-error hover:text-background"
              title="删除"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 密码/密钥 Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text uppercase tracking-wider">
              {state.selectedItem.category === 'Chrome' ? '密码' : 'API Key'}
            </label>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 hover:bg-surface2 rounded transition-colors"
              title={showSecret ? '隐藏密钥' : '显示密钥'}
            >
              {showSecret ? <EyeOff className="w-4 h-4 text-text2" /> : <Eye className="w-4 h-4 text-text2" />}
            </button>
          </div>
          <div className="bg-background rounded-lg p-4 border border-surface2">
            <div className="font-mono text-sm break-all text-text">
              {displaySecret(state.selectedItem.secret_encrypted, showSecret && !state.stealthMode)}
            </div>
          </div>
          
          {/* Copy Options */}
          <div className="flex items-center space-x-2 mt-3">
            <button
              id="detail-copy-raw"
              onClick={() => handleCopy('raw')}
              className="btn btn-sm flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              复制原始值
            </button>
            <button
              id="detail-copy-env"
              onClick={() => handleCopy('env')}
              className="btn btn-sm flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              复制为环境变量
            </button>
            <button
              id="detail-copy-json"
              onClick={() => handleCopy('json')}
              className="btn btn-sm flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              复制为JSON
            </button>
          </div>
        </div>

        {/* 用户名 Section - 针对 Chrome 凭证 */}
        {state.selectedItem.category === 'Chrome' && state.selectedItem.notes && (
          <div>
            <label className="text-sm font-medium text-text uppercase tracking-wider mb-3 block">
              用户名
            </label>
            <div className="bg-background rounded-lg p-4 border border-surface2">
              <div className="text-text">
                {/* 从 notes 中提取用户名 */}
                {state.selectedItem.notes.replace('用户名: ', '')}
              </div>
            </div>
          </div>
        )}

        {/* URL Section */}
        {state.selectedItem.url && (
          <div>
            <label className="text-sm font-medium text-text uppercase tracking-wider mb-3 block">
              URL
            </label>
            <div className="bg-background rounded-lg p-4 border border-surface2">
              <div className="flex items-center justify-between">
                <a
                  href={state.selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent2 flex items-center space-x-2"
                >
                  <span>{state.selectedItem.url}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Notes Section */}
        {state.selectedItem.notes && (
          <div>
            <label className="text-sm font-medium text-text uppercase tracking-wider mb-3 block">
              备注
            </label>
            <div className="bg-background rounded-lg p-4 border border-surface2">
              <div className="text-text whitespace-pre-wrap">
                {state.stealthMode ? displaySecret(state.selectedItem.notes, false) : state.selectedItem.notes}
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center space-x-2 text-sm font-medium text-text uppercase tracking-wider mb-3 hover:text-accent transition-colors"
          >
            <History className="w-4 h-4" />
            <span>密码历史</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showHistory && (
            <div className="bg-background rounded-lg p-4 border border-surface2">
              {loadingHistory ? (
                <div className="text-center py-4 text-text2">加载中...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-4 text-text2">暂无历史记录</div>
              ) : (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div key={record.id} className="border-b border-surface2 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text2">
                          {record.change_reason || '密码变更'}
                        </span>
                        <span className="text-xs text-text2">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-mono text-sm text-text">
                        {displaySecret(record.old_secret_encrypted, false)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div>
          <label className="text-sm font-medium text-text uppercase tracking-wider mb-3 block">
            元数据
          </label>
          <div className="bg-background rounded-lg p-4 border border-surface2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text2">创建时间:</span>
              <span className="text-text">
                {formatDate(new Date())} {/* Replace with actual created_at */}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text2">最后修改:</span>
              <span className="text-text">
                {formatDate(new Date())} {/* Replace with actual last_modified */}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text2">颜色标识:</span>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: state.selectedItem.color }}
                ></div>
                <span className="text-text">{state.selectedItem.color}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}