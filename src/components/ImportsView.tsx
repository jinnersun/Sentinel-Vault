import { useState } from 'react';
import api from '../lib/tauri-api';
import { useApp } from '../contexts/AppContext';
import { CheckCircle, Upload, FileText, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';

interface ImportRecord {
  id: number;
  origin_url: string | null;
  username: string | null;
  password: string;
  status: 'New' | 'Conflict' | 'Identical';
  existing_vault_id?: number;
  existing_password?: string;
}

interface ImportPreview {
  batch_id: string;
  total_count: number;
  new_items: ImportRecord[];
  conflict_items: ImportRecord[];
  identical_count: number;
}

type DecisionType = 'import' | 'update' | 'skip' | null;

interface Decisions {
  [key: number]: DecisionType;
}

export default function ImportsView() {
  const { state, refreshData } = useApp();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{imported: number; updated: number; skipped: number} | null>(null);
  const [showNewItems, setShowNewItems] = useState(true);
  const [showConflictItems, setShowConflictItems] = useState(true);

  // 计算当前已存在的 Chrome 凭证数量
  const existingChromeCount = state.vaultItems.filter(item => item.category === 'Chrome').length;

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }]
      });

      if (selected && typeof selected === 'string') {
        setLoading(true);
        setResult(null);
        
        const data = await api.parseAndCompareCsv(selected);
        setPreview(data);
        
        // 默认决策：New 和 Conflict 都初始化为 null（待用户决定）
        const defaultDecisions: Decisions = {};
        data.new_items.forEach(item => {
          defaultDecisions[item.id] = null;
        });
        data.conflict_items.forEach(item => {
          defaultDecisions[item.id] = null;
        });
        setDecisions(defaultDecisions);
      }
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      alert('解析失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const setDecision = (id: number, decision: DecisionType) => {
    setDecisions(prev => ({ ...prev, [id]: decision }));
  };

  const setAllNew = (decision: 'import' | 'skip') => {
    if (!preview) return;
    const newDecisions = { ...decisions };
    preview.new_items.forEach(item => {
      newDecisions[item.id] = decision;
    });
    setDecisions(newDecisions);
  };

  const setAllConflict = (decision: 'update' | 'skip') => {
    if (!preview) return;
    const newDecisions = { ...decisions };
    preview.conflict_items.forEach(item => {
      newDecisions[item.id] = decision;
    });
    setDecisions(newDecisions);
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    
    const pendingConflicts = preview.conflict_items.filter(item => !decisions[item.id]);
    if (pendingConflicts.length > 0) {
      alert(`还有 ${pendingConflicts.length} 条冲突记录未处理，请选择"更新"或"跳过"`);
      return;
    }

    await executeImport();
  };

  // 执行导入操作
  const executeImport = async (singleItemId?: number, singleDecision?: string) => {
    if (!preview) return;

    setProcessing(true);
    try {
      let decisionList;
      
      if (singleItemId !== undefined && singleDecision) {
        // 单条导入
        decisionList = [{ import_id: singleItemId, decision: singleDecision }];
      } else {
        // 批量导入
        decisionList = Object.entries(decisions)
          .filter(([, d]) => d !== null)
          .map(([id, decision]) => ({
            import_id: parseInt(id),
            decision: decision as string
          }));
      }

      if (decisionList.length === 0) {
        alert('没有选择任何记录导入');
        setProcessing(false);
        return;
      }

      const res = await api.processImportBatch(preview.batch_id, decisionList);
      
      if (singleItemId !== undefined) {
        // 单条导入成功，更新决策状态为已导入（不刷新页面，不显示alert）
        setDecision(singleItemId, 'import');
        // 静默刷新数据
        await refreshData();
      } else {
        // 批量导入完成
        await refreshData();
        setResult(res);
        setPreview(null);
        setDecisions({});
        alert(`导入完成！新增: ${res.imported}, 更新: ${res.updated}, 跳过: ${res.skipped}`);
      }
    } catch (error) {
      console.error('Failed to process import:', error);
      alert('导入失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const getDomainName = (url: string | null) => {
    if (!url) return '未知网站';
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return hostname;
    } catch {
      return url;
    }
  };

  const maskPassword = (password: string) => {
    return '*'.repeat(Math.min(password.length, 12));
  };

  if (result) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-green-500/10 border border-green-500 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">导入完成</h2>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-surface rounded-lg p-3">
                <div className="text-2xl font-bold text-green-500">{result.imported}</div>
                <div className="text-sm text-text2">新增</div>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-500">{result.updated}</div>
                <div className="text-sm text-text2">更新</div>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-500">{result.skipped}</div>
                <div className="text-sm text-text2">跳过</div>
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              className="btn mt-6"
            >
              继续导入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Chrome 导入决策中心</h2>
        <button
          onClick={handleSelectFile}
          className="btn btn-secondary flex items-center space-x-2"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{loading ? '解析中...' : '选择 CSV 文件'}</span>
        </button>
      </div>

      {!preview ? (
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-surface border border-surface2 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">📥</div>
            <h3 className="text-lg font-medium mb-2">从 Chrome 导入密码</h3>
            <p className="text-text2 mb-6">选择 Chrome 导出的 CSV 文件，系统将自动对比并展示差异</p>
            
            {/* 显示现有 Chrome 凭证数量 */}
            <div className="bg-background rounded-lg p-4 mb-6">
              <div className="text-3xl font-bold text-blue-500">{existingChromeCount}</div>
              <div className="text-sm text-text2">现有 Chrome 凭证</div>
            </div>
            
            <div className="bg-background rounded-lg p-4 text-left text-sm text-text2">
              <h4 className="font-medium text-text mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                操作步骤
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                <li>打开 Chrome 设置 → 自动填充 → 密码管理器</li>
                <li>点击设置图标 → 导出密码</li>
                <li>保存 CSV 文件</li>
                <li>点击上方"选择 CSV 文件"按钮</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 统计信息 */}
          <div className="bg-surface border border-surface2 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-blue-500">
                  <span className="text-2xl font-bold">{existingChromeCount}</span>
                  <span className="ml-1">现有</span>
                </div>
                <div>
                  <span className="text-2xl font-bold">{preview.total_count}</span>
                  <span className="text-text2 ml-1">本次导入</span>
                </div>
                <div className="text-green-500">
                  <span className="text-2xl font-bold">{preview.new_items.length}</span>
                  <span className="ml-1">新增</span>
                </div>
                <div className="text-yellow-500">
                  <span className="text-2xl font-bold">{preview.conflict_items.length}</span>
                  <span className="ml-1">冲突</span>
                </div>
                <div className="text-gray-500">
                  <span className="text-2xl font-bold">{preview.identical_count}</span>
                  <span className="ml-1">相同(已跳过)</span>
                </div>
              </div>
              <button
                onClick={handleConfirmImport}
                disabled={processing}
                className="btn"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    处理中...
                  </>
                ) : (
                  '确认导入'
                )}
              </button>
            </div>
          </div>

          {/* 冲突项 */}
          {preview.conflict_items.length > 0 && (
            <div className="bg-surface border border-surface2 rounded-lg">
              <div 
                className="flex items-center justify-between p-4 border-b border-surface2 cursor-pointer"
                onClick={() => setShowConflictItems(!showConflictItems)}
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-medium">冲突项 ({preview.conflict_items.length})</h3>
                  <span className="text-sm text-text2">密码与现有记录不同</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAllConflict('update'); }}
                    className="text-xs btn btn-sm"
                  >
                    全部更新
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAllConflict('skip'); }}
                    className="text-xs btn-secondary btn-sm"
                  >
                    全部跳过
                  </button>
                  {showConflictItems ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              
              {showConflictItems && (
                <div className="divide-y divide-surface2">
                  {preview.conflict_items.map(item => (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{getDomainName(item.origin_url)}</div>
                          <div className="text-sm text-text2">{item.username || '无用户名'}</div>
                          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-background rounded p-2">
                              <div className="text-text2 text-xs">现有密码</div>
                              <div className="font-mono">{maskPassword(item.existing_password || '')}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-yellow-500/30">
                              <div className="text-text2 text-xs">导入密码</div>
                              <div className="font-mono">{maskPassword(item.password)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={() => setDecision(item.id, 'update')}
                            className={`btn btn-sm ${decisions[item.id] === 'update' ? 'bg-yellow-500 text-black' : ''}`}
                          >
                            {decisions[item.id] === 'update' ? '✓ 更新' : '更新并归档'}
                          </button>
                          <button
                            onClick={() => setDecision(item.id, 'skip')}
                            className={`btn-secondary btn-sm ${decisions[item.id] === 'skip' ? 'bg-gray-500 text-white' : ''}`}
                          >
                            {decisions[item.id] === 'skip' ? '✓ 跳过' : '跳过'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 新增项 */}
          {preview.new_items.length > 0 && (
            <div className="bg-surface border border-surface2 rounded-lg">
              <div 
                className="flex items-center justify-between p-4 border-b border-surface2 cursor-pointer"
                onClick={() => setShowNewItems(!showNewItems)}
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-medium">新增项 ({preview.new_items.length})</h3>
                  <span className="text-sm text-text2">库中不存在的记录</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAllNew('import'); }}
                    className="text-xs btn btn-sm"
                  >
                    全部导入
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAllNew('skip'); }}
                    className="text-xs btn-secondary btn-sm"
                  >
                    全部跳过
                  </button>
                  {showNewItems ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              
              {showNewItems && (
                <div className="divide-y divide-surface2">
                  {preview.new_items.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{getDomainName(item.origin_url)}</div>
                        <div className="text-sm text-text2">{item.username || '无用户名'}</div>
                        <div className="text-sm font-mono mt-1">{maskPassword(item.password)}</div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => executeImport(item.id, 'import')}
                          disabled={processing || decisions[item.id] === 'import'}
                          className={`btn btn-sm ${decisions[item.id] === 'import' ? 'bg-green-500 text-white cursor-not-allowed' : ''}`}
                        >
                          {processing ? '处理中...' : (decisions[item.id] === 'import' ? '✓ 已导入' : '导入')}
                        </button>
                        <button
                          onClick={() => setDecision(item.id, 'skip')}
                          disabled={decisions[item.id] === 'import'}
                          className={`btn-secondary btn-sm ${decisions[item.id] === 'skip' ? 'bg-gray-500 text-white' : ''} ${decisions[item.id] === 'import' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {decisions[item.id] === 'skip' ? '✓ 跳过' : '跳过'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
