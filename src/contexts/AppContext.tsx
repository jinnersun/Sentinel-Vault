import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AppState, VaultItem, Project } from '../types';
import api from '../lib/tauri-api';

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VAULT_ITEMS'; payload: VaultItem[] }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_SELECTED_PROJECT'; payload: number | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_ITEM'; payload: VaultItem | null }
  | { type: 'TOGGLE_STEALTH_MODE' }
  | { type: 'SET_MASTER_PASSWORD_VERIFIED'; payload: boolean }
  | { type: 'ADD_VAULT_ITEM'; payload: VaultItem }
  | { type: 'UPDATE_VAULT_ITEM'; payload: { id: number; item: VaultItem } }
  | { type: 'DELETE_VAULT_ITEM'; payload: number }
  | { type: 'ADD_PROJECT'; payload: Project };

const initialState: AppState = {
  vaultItems: [],
  projects: [],
  selectedProject: null,
  searchQuery: '',
  selectedItem: null,
  isLoading: true,
  stealthMode: false,
  masterPasswordVerified: false,
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

  const refreshData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [vaultItems, projects] = await Promise.all([
        api.getVaultItems(),
        api.getProjects(),
      ]);
      dispatch({ type: 'SET_VAULT_ITEMS', payload: vaultItems });
      dispatch({ type: 'SET_PROJECTS', payload: projects });
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
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
        // masterPasswordVerified should be false until user sets or verifies password
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
      } catch (error) {
        console.error('Failed to check master password:', error);
        // Assume password is needed if check fails
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
      }
    };
    
    checkMasterPassword();
  }, []);

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