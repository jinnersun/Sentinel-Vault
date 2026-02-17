import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AppState, VaultItem, Project } from '../types';
import api from '../lib/tauri-api';

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VAULT_ITEMS'; payload: VaultItem[] }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_SELECTED_PROJECT'; payload: number | null }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_ITEM'; payload: VaultItem | null }
  | { type: 'TOGGLE_STEALTH_MODE' }
  | { type: 'SET_MASTER_PASSWORD_VERIFIED'; payload: boolean }
  | { type: 'ADD_VAULT_ITEM'; payload: VaultItem }
  | { type: 'UPDATE_VAULT_ITEM'; payload: { id: number; item: VaultItem } }
  | { type: 'DELETE_VAULT_ITEM'; payload: number }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: number }
  | { type: 'SET_CURRENT_VIEW'; payload: import('../types').ViewType }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_SAVE_CALLBACK'; payload: (() => Promise<void>) | null }
  | { type: 'SET_SECURITY_ALERT_COUNT'; payload: number };

const initialState: AppState = {
  vaultItems: [],
  projects: [],
  selectedProject: null,
  selectedCategory: null,
  searchQuery: '',
  selectedItem: null,
  isLoading: true,
  stealthMode: false,
  masterPasswordVerified: false,
  currentView: 'vault',
  hasUnsavedChanges: false,
  saveCallback: null,
  securityAlertCount: 0,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_VAULT_ITEMS':
      return { ...state, vaultItems: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProject: action.payload };
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_ITEM':
      return { ...state, selectedItem: action.payload };
    case 'TOGGLE_STEALTH_MODE':
      return { ...state, stealthMode: !state.stealthMode };
    case 'SET_MASTER_PASSWORD_VERIFIED':
      return { ...state, masterPasswordVerified: action.payload };
    case 'ADD_VAULT_ITEM':
      return { ...state, vaultItems: [action.payload, ...state.vaultItems] };
    case 'UPDATE_VAULT_ITEM':
      return {
        ...state,
        vaultItems: state.vaultItems.map(item =>
          item.id === action.payload.id ? action.payload.item : item
        ),
      };
    case 'DELETE_VAULT_ITEM':
      return {
        ...state,
        vaultItems: state.vaultItems.filter(item => item.id !== action.payload),
      };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        selectedProject: state.selectedProject === action.payload ? null : state.selectedProject
      };
    case 'SET_CURRENT_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    case 'SET_SAVE_CALLBACK':
      return { ...state, saveCallback: action.payload };
    case 'SET_SECURITY_ALERT_COUNT':
      return { ...state, securityAlertCount: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  refreshData: () => Promise<void>;
  searchItems: (query: string) => Promise<void>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const refreshData = async (silent: boolean = false) => {
    try {
      // 只有在非静默模式下才显示全屏 Loading
      if (!silent) {
        dispatch({ type: 'SET_LOADING', payload: true });
      }
      
      const [projects, projectCounts] = await Promise.all([
        api.getProjects(),
        api.getProjectCounts(),
      ]);

      // Vault items: fetch by selected project if present
      const vaultItems = await api.getVaultItemsByProject(state.selectedProject ?? null);

      // Merge counts into projects (projectCounts entries include count)
      const projectsMap = new Map<number, any>();
      projectCounts.forEach((p: any) => {
        if (p.id != null) projectsMap.set(p.id, p.count ?? 0);
      });

      const projectsWithCounts = projects.map(p => ({ ...p, count: p.id ? projectsMap.get(p.id) ?? 0 : 0 }));

      dispatch({ type: 'SET_VAULT_ITEMS', payload: vaultItems });
      dispatch({ type: 'SET_PROJECTS', payload: projectsWithCounts });
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      // 只有在非静默模式下才重置全局 Loading
      if (!silent) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  };

  const searchItems = async (query: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      if (query.trim()) {
        const items = await api.searchItems(query.trim());
        dispatch({ type: 'SET_VAULT_ITEMS', payload: items });
      } else {
        await refreshData();
      }
    } catch (error) {
      console.error('Failed to search items:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  useEffect(() => {
    refreshData();
    
    // Check if master password is set
    const checkMasterPassword = async () => {
      try {
        const isSet = await api.hasMasterPassword();
        // masterPasswordVerified should be true if password already set
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: !!isSet });
      } catch (error) {
        console.error('Failed to check master password:', error);
        // Assume password is needed if check fails
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
      }
    };
    
    checkMasterPassword();
  }, []);

  // When selected project changes, refresh vault items accordingly
  useEffect(() => {
    // avoid calling on initial mount (refreshData already called)
    // 使用静默刷新，避免切换项目/分类时出现全屏 Loading
    refreshData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedProject]);

  return (
    <AppContext.Provider value={{ state, dispatch, refreshData, searchItems }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}