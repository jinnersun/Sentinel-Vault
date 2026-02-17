import { useEffect, useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const { state, dispatch, searchItems } = useApp();
  const [localQuery, setLocalQuery] = useState(state.searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部搜索词变化
  useEffect(() => {
    if (state.searchQuery !== localQuery) {
      setLocalQuery(state.searchQuery);
    }
  }, [state.searchQuery]);

  // 快捷键聚焦
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 回车搜索
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'SET_SEARCH_QUERY', payload: localQuery });
      searchItems(localQuery);
      inputRef.current?.blur();
    }
  };

  // 清空搜索
  const handleClear = () => {
    setLocalQuery('');
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    searchItems('');
  };

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text2" />
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索标题、备注或URL... (Ctrl+K 聚焦, Enter 搜索)"
        className="input pl-10 pr-20"
      />
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
        {localQuery && (
          <button
            onClick={handleClear}
            className="text-xs text-text2 hover:text-error px-2 py-1 rounded hover:bg-surface2"
          >
            清空
          </button>
        )}
        <kbd className="text-xs text-text2 bg-surface2 px-2 py-1 rounded">⌘K</kbd>
      </div>
    </div>
  );
}