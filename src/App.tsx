
import { useEffect } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import PasswordScreen from './components/PasswordScreen';
import MainLayout from './components/MainLayout';
import LoadingScreen from './components/LoadingScreen';

function AppContent() {
  const { state, dispatch } = useApp();

  // 全局快捷键：Ctrl+L 锁定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: false });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  if (!state.masterPasswordVerified) {
    return <PasswordScreen />;
  }

  return <MainLayout />;
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;