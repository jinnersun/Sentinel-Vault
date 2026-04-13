
import { useApp } from '../contexts/AppContext';
import { Eye, EyeOff, Plus, Key, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Toolbar({ onNewItem }: { onNewItem: () => void }) {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();

  const handleNewItem = () => {
    onNewItem();
  };

  return (
    <div className="flex items-center space-x-2">
      {/* New Item Button */}
      <button
        onClick={handleNewItem}
        className="btn btn-sm flex items-center space-x-2"
        title={t('toolbar.newItem')}
      >
        <Plus className="w-4 h-4" />
        <span>{t('toolbar.new')}</span>
      </button>

      {/* Lock Button */}
      <button
        onClick={() => dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false })}
        className="p-2 rounded-lg transition-colors hover:bg-surface2 text-text2"
        title={t('toolbar.lock')}
      >
        <Lock className="w-4 h-4" />
      </button>

      {/* Stealth Mode Toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_STEALTH_MODE' })}
        className={`p-2 rounded-lg transition-colors ${
          state.stealthMode 
            ? 'bg-warning text-background' 
            : 'hover:bg-surface2 text-text2'
        }`}
        title={state.stealthMode ? t('toolbar.stealthModeOn') : t('toolbar.stealthModeOff')}
      >
        {state.stealthMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      {/* Quick Key Info */}
      {state.vaultItems.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-text2">
          <Key className="w-4 h-4" />
          <span>{t('toolbar.credentialsCount', { count: state.vaultItems.length })}</span>
        </div>
      )}
    </div>
  );
}