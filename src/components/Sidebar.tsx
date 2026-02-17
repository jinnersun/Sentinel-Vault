import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { FolderPlus, Settings, Download, Upload, Edit2, Trash2, Key, Server, Shield, AlertTriangle, Globe, ShieldCheck } from 'lucide-react';
import type { Project } from '../types';
import api from '../lib/tauri-api';
import { showUnsavedDialog } from '../hooks/useUnsavedChanges';

export default function Sidebar() {
  const { state, dispatch, refreshData } = useApp();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  // 加载安全提醒数量
  useEffect(() => {
    const loadAlertCount = async () => {
      try {
        const overview = await api.getSecurityOverview();
        const total = overview.rotation_overdue + overview.rotation_warning +
                     overview.expiry_overdue + overview.expiry_warning;
        setAlertCount(total);
        dispatch({ type: 'SET_SECURITY_ALERT_COUNT', payload: total });
      } catch (error) {
        console.error('Failed to load security alert count:', error);
      }
    };
    loadAlertCount();
    // 每30秒刷新一次
    const interval = setInterval(loadAlertCount, 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // 检查未保存更改并执行操作
  const checkUnsavedAndExecute = async (action: () => void) => {
    if (state.hasUnsavedChanges) {
      const result = await showUnsavedDialog('您有未保存的更改');
      if (result === 'cancel') return;
      if (result === 'save') {
        // 用户选择保存，执行保存回调
        if (state.saveCallback) {
          try {
            await state.saveCallback();
          } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败，无法跳转');
            return;
          }
        }
        // 保存成功后继续执行跳转
      }
      // result === 'discard' 或保存成功，继续执行
    }
    action();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }

    try {
      const projectData = {
        name: newProjectName.trim(),
        color: '#10b981',
        status: 'active',
        description: '',
        arch_desc: '',
        urls_json: '[]',
      };
      
      console.log('Creating project:', projectData);
      const id = await api.createProject(projectData);
      console.log('Project created with ID:', id);
      
      // Update local state immediately to avoid UI flicker
      dispatch({
        type: 'ADD_PROJECT',
        payload: { 
          id, 
          name: newProjectName.trim(), 
          color: '#10b981',
          status: 'active',
          description: '',
          arch_desc: '',
          urls_json: '[]',
        },
      });
      
      setNewProjectName('');
      setShowNewProject(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Failed to create project:', error);
      alert(`创建项目失败: ${errorMsg}`);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;

    try {
      await api.updateProject(editingProject.id!, {
        name: editName.trim(),
        color: editingProject.color,
        status: editingProject.status,
        description: editingProject.description,
        arch_desc: editingProject.arch_desc,
        readme_path: editingProject.readme_path,
        urls_json: editingProject.urls_json,
      });
      await refreshData();
      setEditingProject(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('更新项目失败');
    }
  };

  // 修复：改进的删除逻辑
  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    // 1. 必须优先切断冒泡，防止触发父级的 onClick 选中逻辑
    e.preventDefault();
    e.stopPropagation();

    // 修复：检查是否已在删除中（防止多次点击）
    if (deletingProjectId !== null) {
      return;
    }

    // 2. 使用异步确认对话框，确保UI不会提前更新
    const confirmed = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm(`确定要删除项目 "${project.name}" 吗？\n注意：该项目下的所有关联将被移除，但凭证不会被删除。`);
        resolve(result);
      }, 0);
    });

    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id ?? null);

    try {
      // 关键修改：先调用后端 API，不做乐观更新
      await api.deleteProject(project.id!);
      
      // 只有后端成功返回，才更新本地 Redux 状态
      dispatch({ type: 'DELETE_PROJECT', payload: project.id! });
      
      // 如果当前选中的是被删除的项目，清空选中状态
      if (state.selectedProject === project.id) {
        dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
      }
      
      console.log(`成功删除项目 "${project.name}"`);
    } catch (error) {
      console.error('删除失败:', error);
      alert(`删除 "${project.name}" 失败，请重试\n${error instanceof Error ? error.message : '未知错误'}`);
      // 失败时不需要调用 refreshData，因为我们从未修改本地状态
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <div className="w-64 bg-surface border-r border-surface2 flex flex-col h-full overflow-hidden">
      {/* 模块 1: 项目 (占据上方 50% 空间并可滚动) */}
      <div className="flex-[0.5] flex flex-col min-h-0 border-b border-surface2">
        <div className="p-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs font-bold text-text2 uppercase">我的项目</h2>
          <button
            onClick={() => setShowNewProject(true)}
            className="p-1 hover:bg-surface2 rounded transition-colors"
            title="新建项目"
          >
            <FolderPlus className="w-4 h-4 text-text2" />
          </button>
        </div>

        {/* All Items */}
        <div
          className={`flex items-center space-x-2 p-2 mx-4 mb-2 rounded cursor-pointer transition-colors ${
            !state.selectedProject && state.currentView === 'vault' && !state.selectedCategory ? 'bg-surface2 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'vault' });
              dispatch({ type: 'SET_SELECTED_CATEGORY', payload: null });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <div className="w-4 h-4 bg-accent rounded"></div>
          <span className="text-sm font-medium">
            全部条目 ({state.vaultItems.filter(i => i.category !== 'Chrome' && i.category !== 'API').length})
          </span>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 custom-scrollbar min-h-0">
        {state.projects.map((project) => (
          <div
            key={project.id}
            className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors group ${
              state.selectedProject === project.id && state.currentView === 'vault' ? 'bg-surface2 text-accent' : 'hover:bg-surface2'
            }`}
            onClick={() => {
              checkUnsavedAndExecute(() => {
                dispatch({ type: 'SET_CURRENT_VIEW', payload: 'vault' });
                dispatch({ type: 'SET_SELECTED_PROJECT', payload: project.id! });
                dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
              });
            }}
          >
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: project.color }}
            ></div>
            <span className="text-sm font-medium flex-1">{project.name}</span>
            <span className="text-xs text-text2">
              ({project.count ?? 0})
            </span>
            <div className="hidden group-hover:flex items-center space-x-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditProject(project);
                }}
                className="p-1 hover:bg-surface rounded"
                title="编辑项目"
              >
                <Edit2 className="w-3 h-3 text-text2" />
              </button>
              <button
                onClick={(e) => {
                  handleDeleteProject(e, project);
                }}
                className="p-1 hover:bg-surface rounded"
                title="删除项目"
              >
                <Trash2 className="w-3 h-3 text-error" />
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* 模块 2: Chrome 浏览器凭证 (中间区域) */}
      <div className="p-2 border-b border-surface2">
        <div className="flex items-center space-x-2 mb-2">
          <button 
            className={`flex-1 flex items-center space-x-2 p-3 rounded-lg transition-all ${
              state.currentView === 'vault' && state.selectedCategory === 'Chrome' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
            }`}
            onClick={() => {
              checkUnsavedAndExecute(() => {
                dispatch({ type: 'SET_CURRENT_VIEW', payload: 'vault' });
                dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'Chrome' });
                dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
                dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
              });
            }}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-semibold">Chrome 凭证</span>
          </button>
          <button
            onClick={() => checkUnsavedAndExecute(() => dispatch({ type: 'SET_CURRENT_VIEW', payload: 'imports' }))}
            className="p-3 rounded-lg hover:bg-surface2 text-text2"
            title="从 CSV 导入"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 模块 3: 基础设施资产 */}
      <div className="p-2 border-b border-surface2">
        <button 
          className={`flex items-center space-x-2 p-3 rounded-lg w-full transition-all ${
            state.currentView === 'infrastructure' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'infrastructure' });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <Server className="w-4 h-4" />
          <span className="text-sm font-semibold">基础设施</span>
        </button>
      </div>

      {/* 模块 4: API Keys */}
      <div className="p-2">
        <button 
          className={`flex items-center space-x-2 p-3 rounded-lg w-full transition-all ${
            state.currentView === 'vault' && state.selectedCategory === 'API' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'vault' });
              dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'API' });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <Key className="w-4 h-4" />
          <span className="text-sm font-semibold">API Keys 仓库</span>
        </button>
      </div>

      {/* 域名管理 */}
      <div className="p-2">
        <button 
          className={`flex items-center space-x-2 p-3 rounded-lg w-full transition-all ${
            state.currentView === 'domains' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'domains' });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-semibold">域名管理</span>
        </button>
      </div>

      {/* SSL证书 */}
      <div className="p-2">
        <button 
          className={`flex items-center space-x-2 p-3 rounded-lg w-full transition-all ${
            state.currentView === 'certificates' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'certificates' });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-sm font-semibold">SSL证书</span>
        </button>
      </div>

      {/* 安全中心 */}
      <div className="p-2">
        <button 
          className={`flex items-center justify-between p-3 rounded-lg w-full transition-all ${
            state.currentView === 'security' ? 'bg-accent/10 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => {
            checkUnsavedAndExecute(() => {
              dispatch({ type: 'SET_CURRENT_VIEW', payload: 'security' });
              dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
              dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
            });
          }}
        >
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">安全中心</span>
          </div>
          {alertCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {alertCount}
            </span>
          )}
        </button>
      </div>

      {/* 设置按钮 - 固定在底部 */}
      <div className="mt-auto p-4 border-t border-surface2 bg-surface/50 flex-shrink-0">
        <button 
          className={`flex items-center space-x-2 p-2 rounded w-full transition-colors ${
            state.currentView === 'settings' ? 'bg-surface2 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => checkUnsavedAndExecute(() => dispatch({ type: 'SET_CURRENT_VIEW', payload: 'settings' }))}
        >
          <Settings className="w-4 h-4 text-text2" />
          <span className="text-sm text-text2">设置</span>
        </button>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 w-80">
            <h3 className="text-lg font-semibold text-text mb-4">新建项目</h3>
            <form onSubmit={handleCreateProject}>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="input mb-4"
                placeholder="项目名称"
                autoFocus
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn flex-1">
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProject(false);
                    setNewProjectName('');
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

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 w-80">
            <h3 className="text-lg font-semibold text-text mb-4">编辑项目</h3>
            <form onSubmit={handleUpdateProject}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input mb-4"
                placeholder="项目名称"
                autoFocus
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn flex-1">
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setEditName('');
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
    </div>
  );
}