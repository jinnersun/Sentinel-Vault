import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/tauri-api';

export default function PasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewPassword, setIsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { dispatch } = useApp();

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
          setError('密码不匹配');
          return;
        }
        if (password.length < 8) {
          setError('密码至少需要8个字符');
          return;
        }
        await api.setMasterPassword(password);
        dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: true });
      } else {
        const isValid = await api.verifyMasterPassword(password);
        if (isValid) {
          dispatch({ type: 'SET_MASTER_PASSWORD_VERIFIED', payload: true });
        } else {
          setError('密码错误');
        }
      }
    } catch (error) {
      setError('操作失败，请重试');
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
              <p className="text-text2">初始化中...</p>
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
            <p className="text-text2">开发者凭证管理器</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {isNewPassword ? '设置主密码' : '输入主密码'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="请输入密码"
                autoFocus
                required
              />
            </div>

            {isNewPassword && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="请再次输入密码"
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
              {isLoading ? '验证中...' : isNewPassword ? '设置密码' : '解锁'}
            </button>

            {!isNewPassword && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsNewPassword(true)}
                  className="text-accent hover:text-accent2 text-sm"
                >
                  首次使用？设置主密码
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}