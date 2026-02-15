import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const { state, dispatch, searchItems } = useApp();
  const [localQuery, setLocalQuery] = useState(state.searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== state.searchQuery) {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: localQuery });
        searchItems(localQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, state.searchQuery, dispatch, searchItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text2" />
      <input
        id="search-input"
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="搜索标题、备注或URL... (Ctrl+K)"
        className="input pl-10"
      />
      {!localQuery && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <kbd className="text-xs text-text2 bg-surface2 px-2 py-1 rounded">⌘K</kbd>
        </div>
      )}
    </div>
  );
}