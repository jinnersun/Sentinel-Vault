
import { AppProvider, useApp } from './contexts/AppContext';
import PasswordScreen from './components/PasswordScreen';
import MainLayout from './components/MainLayout';
import LoadingScreen from './components/LoadingScreen';

function AppContent() {
  const { state } = useApp();

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