
import { useApp } from '../contexts/AppContext';
import { Eye, EyeOff, Plus, Key } from 'lucide-react';

export default function Toolbar({ onNewItem }: { onNewItem: () => void }) {
  const { state, dispatch } = useApp();

  const handleNewItem = () => {
    onNewItem();
  };

  return (
    <div className="flex items-center space-x-2">
      {/* New Item Button */}
      <button
        onClick={handleNewItem}
        className="btn btn-sm flex items-center space-x-2"
        title="新建条目 (Ctrl+N)"
      >
        <Plus className="w-4 h-4" />
        <span>新建</span>
      </button>

      {/* Stealth Mode Toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_STEALTH_MODE' })}
        className={`p-2 rounded-lg transition-colors ${
          state.stealthMode 
            ? 'bg-warning text-background' 
            : 'hover:bg-surface2 text-text2'
        }`}
        title={state.stealthMode ? '退出隐身模式' : '进入隐身模式'}
      >
        {state.stealthMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      {/* Quick Key Info */}
      {state.vaultItems.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-text2">
          <Key className="w-4 h-4" />
          <span>{state.vaultItems.length} 个凭证</span>
        </div>
      )}
    </div>
  );
}