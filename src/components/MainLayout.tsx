import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Sidebar from './Sidebar';
import VaultList from './VaultList';
import ItemDetail from './ItemDetail';
import ProjectDashboard from './ProjectDashboard';
import ProjectRelations from './ProjectRelations';
import ImportsView from './ImportsView';
import ApiKeysView from './ApiKeysView';
import SettingsView from './SettingsView';
import InfrastructureView from './InfrastructureView';
import SearchBar from './SearchBar';
import Toolbar from './Toolbar';
import ItemModal from './ItemModal';

export default function MainLayout() {
  const { state } = useApp();
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompactMode = windowSize.width < 800;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface border-b border-surface2 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {!isCompactMode && <h1 className="text-xl font-bold text-accent">DevVault</h1>}
          </div>
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <SearchBar />
          </div>
          <Toolbar onNewItem={() => setIsModalOpen(true)} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {!isCompactMode && <Sidebar />}

        {/* Main Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Vault View */}
          {state.currentView === 'vault' && (
            <>
              {/* 中间区域：根据选择显示不同内容 */}
              {state.selectedProject && !state.selectedItem ? (
                // 选中项目但未选中凭证：显示项目三栏布局
                <>
                  {/* 中间：项目信息 */}
                  <div className="flex-1 overflow-hidden border-r border-surface2">
                    {(() => {
                      const project = state.projects.find(p => p.id === state.selectedProject);
                      return project ? <ProjectDashboard project={project} /> : null;
                    })()}
                  </div>
                  {/* 右侧：项目关联资源 */}
                  <div className="w-96 overflow-hidden">
                    <ProjectRelations />
                  </div>
                </>
              ) : (
                // 默认：显示凭证列表 + 详情
                <>
                  {/* Vault List */}
                  <div className={`${isCompactMode ? 'w-full' : 'w-96'} border-r border-surface2 overflow-hidden flex flex-col`}>
                    <VaultList 
                      onEditItem={(item) => {
                        setEditingItem(item);
                        setIsModalOpen(true);
                      }}
                    />
                  </div>
                  {/* Item Detail */}
                  {!isCompactMode && (
                    <div className="flex-1 overflow-hidden">
                      {state.selectedItem ? (
                        <ItemDetail 
                          onEditItem={(item) => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                        />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-text2 h-full">
                          <div className="text-center">
                            <div className="text-6xl mb-4">🔐</div>
                            <p className="text-lg">选择一个条目查看详情</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Imports View */}
          {state.currentView === 'imports' && (
            <div className="flex-1 overflow-auto">
              <ImportsView />
            </div>
          )}

          {/* API Keys View */}
          {state.currentView === 'apikeys' && (
            <div className="flex-1 overflow-auto">
              <ApiKeysView />
            </div>
          )}

          {/* Settings View */}
          {state.currentView === 'settings' && (
            <div className="flex-1 overflow-auto">
              <SettingsView />
            </div>
          )}

          {/* Infrastructure View */}
          {state.currentView === 'infrastructure' && (
            <div className="flex-1 overflow-hidden">
              <InfrastructureView />
            </div>
          )}
        </div>
      </div>

      {/* Item Modal */}
      <ItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
      />
    </div>
  );
}