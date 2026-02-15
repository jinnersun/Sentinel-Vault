import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { FolderPlus, Settings } from 'lucide-react';
import api from '../lib/tauri-api';

export default function Sidebar() {
  const { state, dispatch, refreshData } = useApp();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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
          color: '#10b981' 
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



  return (
    <div className="w-64 bg-surface border-r border-surface2 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-surface2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider">项目</h2>
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
          className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
            !state.selectedProject ? 'bg-surface2 text-accent' : 'hover:bg-surface2'
          }`}
          onClick={() => dispatch({ type: 'SET_SELECTED_PROJECT', payload: null })}
        >
          <div className="w-4 h-4 bg-accent rounded"></div>
          <span className="text-sm font-medium">
            全部条目 ({state.vaultItems.length})
          </span>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {state.projects.map((project) => (
          <div
            key={project.id}
            className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
              state.selectedProject === project.id ? 'bg-surface2 text-accent' : 'hover:bg-surface2'
            }`}
            onClick={() => dispatch({ type: 'SET_SELECTED_PROJECT', payload: project.id! })}
          >
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: project.color }}
            ></div>
            <span className="text-sm font-medium">{project.name}</span>
            <span className="text-xs text-text2 ml-auto">
              ({state.vaultItems.filter(item => item.project_id === project.id).length})
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface2">
        <button className="flex items-center space-x-2 p-2 hover:bg-surface2 rounded w-full transition-colors">
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
    </div>
  );
}