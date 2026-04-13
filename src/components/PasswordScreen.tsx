import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/tauri-api';
import { useTranslation } from 'react-i18next';

export default function PasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewPassword, setIsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { dispatch } = useApp();
  const { t } = useTranslation();

  useEffect(() => {
    const checkPasswordStatus = async () => {
      try {
        const hasPassword = await api.hasMasterPassword();
        setIsNewPassword(!hasPassword);
      } catch (error) {
        console.error('Failed to check password status:', error);
        setIsNewPassword(false);
      } finally {
        setIsInitializing(false);
      }
    };

    checkPasswordStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isNewPassword) {
        if (password !== confirmPassword) {
          setError(t('password.error.mismatch'));
          return;
        }
        if (password.length < 8) {
          setError(t('password.error.tooShort'));
          return;
        }
        await api.setMasterPassword(password);
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: true });
      } else {
        const isValid = await api.verifyMasterPassword(password);
        if (isValid) {
          dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: true });
        } else {
          setError(t('password.error.wrong'));
        }
      }
    } catch (error) {
      setError(t('password.error.failed'));
      console.error('Password verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="text-center">
              <p className="text-text2">{t('app.initializing')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-accent mb-2">DevVault</h1>
            <p className="text-text2">{t('password.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {isNewPassword ? t('password.setTitle') : t('password.title')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t('password.placeholder')}
                autoFocus
                required
              />
            </div>

            {isNewPassword && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  {t('password.confirmLabel')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder={t('password.confirmPlaceholder')}
                  required
                />
              </div>
            )}

            {error && (
              <div className="text-error text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn w-full disabled:opacity-50"
            >
              {isLoading ? t('password.verifying') : isNewPassword ? t('password.setPassword') : t('password.unlock')}
            </button>

            {!isNewPassword && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsNewPassword(true)}
                  className="text-accent hover:text-accent2 text-sm"
                >
                  {t('password.firstTime')}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}