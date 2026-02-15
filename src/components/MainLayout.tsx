import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Sidebar from './Sidebar';
import VaultList from './VaultList';
import ItemDetail from './ItemDetail';
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-surface2 px-4 py-3">
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
          {!isCompactMode && state.selectedItem && (
            <div className="flex-1 overflow-hidden">
              <ItemDetail 
                onEditItem={(item) => {
                  setEditingItem(item);
                  setIsModalOpen(true);
                }}
              />
            </div>
          )}

          {!isCompactMode && !state.selectedItem && (
            <div className="flex-1 flex items-center justify-center text-text2">
              <div className="text-center">
                <div className="text-6xl mb-4">🔐</div>
                <p className="text-lg">选择一个条目查看详情</p>
              </div>
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