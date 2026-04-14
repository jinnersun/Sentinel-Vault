import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/tauri-api';
import { open, save } from '@tauri-apps/api/dialog';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { 
  Shield, 
  Database, 
  Trash2, 
  Download, 
  Upload,
  Eye,
  EyeOff,
  Save,
  AlertTriangle
} from 'lucide-react';

export default function SettingsView() {
  const { dispatch, refreshData } = useApp();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(30);
  const [clipboardClearSeconds, setClipboardClearSeconds] = useState(30);
  const [language, setLanguage] = useState(i18n.language || 'zh');

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const autoLock = await api.getSetting('auto_lock_minutes');
        const clipboardClear = await api.getSetting('clipboard_clear_seconds');
        if (autoLock) setAutoLockMinutes(parseInt(autoLock));
        if (clipboardClear) setClipboardClearSeconds(parseInt(clipboardClear));
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      alert(t('settings.security.errors.currentRequired'));
      return;
    }
    if (masterPassword !== confirmPassword) {
      alert(t('settings.security.errors.mismatch'));
      return;
    }
    if (masterPassword.length < 6) {
      alert(t('settings.security.errors.tooShort'));
      return;
    }
    try {
      // 验证当前密码
      const isValid = await api.verifyMasterPassword(currentPassword);
      if (!isValid) {
        alert(t('settings.security.errors.wrong'));
        return;
      }
      await api.setMasterPassword(masterPassword);
      alert(t('settings.security.errors.success'));
      setCurrentPassword('');
      setMasterPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to change password:', error);
      alert(t('settings.security.errors.failed'));
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const savePath = await save({
        filters: [{
          name: 'Database',
          extensions: ['db']
        }],
        defaultPath: 'devvault_backup.db'
      });
      
      if (savePath && typeof savePath === 'string') {
        await api.backupDatabase(savePath);
        alert(t('settings.data.backupSuccess'));
      }
    } catch (error) {
      console.error('Failed to backup database:', error);
      alert(t('settings.data.backupFailed'));
    }
  };

  const handleSwitchDatabase = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Database',
          extensions: ['db']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        // 切换数据库需要重启应用
        alert(t('settings.data.switchSuccess'));
      }
    } catch (error) {
      console.error('Failed to switch database:', error);
      alert(t('settings.data.switchFailed'));
    }
  };

  const handleClearAllData = async () => {
    // 使用异步顺序确认，确保对话框按顺序显示
    const confirmed1 = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm(t('settings.danger.confirm1'));
        resolve(result);
      }, 0);
    });

    if (!confirmed1) {
      return;
    }

    // 等待第一个确认完成后再显示第二个确认
    const confirmed2 = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm(t('settings.danger.confirm2'));
        resolve(result);
      }, 0);
    });

    if (!confirmed2) {
      return;
    }

    try {
      // 先调用后端 API 清空数据
      await api.clearAllData();
      // API 成功后再清空前端状态
      dispatch({ type: 'SET_VAULT_ITEMS', payload: [] });
      dispatch({ type: 'SET_PROJECTS', payload: [] });
      dispatch({ type: 'SET_SELECTED_ITEM', payload: null });
      dispatch({ type: 'SET_SELECTED_PROJECT', payload: null });
      alert(t('settings.danger.clearSuccess'));
      await refreshData();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert(t('settings.danger.clearFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang);
    await i18n.changeLanguage(newLang);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">{t('settings.title')}</h2>

      {/* 安全设置 */}
      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Shield className="w-5 h-5 mr-2 text-accent" />
          <h3 className="text-lg font-medium">{t('settings.security.title')}</h3>
        </div>
        
        <div className="bg-surface border border-surface2 rounded-lg p-6 space-y-6">
          {/* 修改主密码 */}
          <div>
            <h4 className="font-medium mb-3">{t('settings.security.changePassword')}</h4>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input w-full"
                placeholder={t('settings.security.currentPassword')}
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder={t('settings.security.newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input w-full"
                placeholder={t('settings.security.confirmPassword')}
              />
              <button type="submit" className="btn flex items-center space-x-2">
                <Save className="w-4 h-4" />
                <span>{t('settings.security.savePassword', '保存密码')}</span>
              </button>
            </form>
          </div>

          <div className="border-t border-surface2 pt-4">
            <h4 className="font-medium mb-3">{t('settings.security.autoLock')}</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text2">{t('settings.security.autoLockDesc')}</span>
              <select
                value={autoLockMinutes}
                onChange={async (e) => {
                  const value = Number(e.target.value);
                  setAutoLockMinutes(value);
                  try {
                    await api.updateSetting('auto_lock_minutes', value.toString());
                  } catch (error) {
                    console.error('Failed to save auto lock setting:', error);
                  }
                }}
                className="input"
              >
                <option value={5}>{t('settings.security.timeOptions.5minutes')}</option>
                <option value={10}>{t('settings.security.timeOptions.10minutes')}</option>
                <option value={30}>{t('settings.security.timeOptions.30minutes')}</option>
                <option value={60}>{t('settings.security.timeOptions.1hour')}</option>
                <option value={0}>{t('settings.security.timeOptions.never')}</option>
              </select>
              <span className="text-sm text-text2">{t('settings.security.autoLockSuffix')}</span>
            </div>
          </div>

          <div className="border-t border-surface2 pt-4">
            <h4 className="font-medium mb-3">{t('settings.security.clipboardClear')}</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text2">{t('settings.security.clipboardClearDesc')}</span>
              <select
                value={clipboardClearSeconds}
                onChange={async (e) => {
                  const value = Number(e.target.value);
                  setClipboardClearSeconds(value);
                  try {
                    await api.updateSetting('clipboard_clear_seconds', value.toString());
                  } catch (error) {
                    console.error('Failed to save clipboard setting:', error);
                  }
                }}
                className="input"
              >
                <option value={10}>{t('settings.security.timeOptions.10seconds')}</option>
                <option value={30}>{t('settings.security.timeOptions.30seconds')}</option>
                <option value={60}>{t('settings.security.timeOptions.1minute')}</option>
                <option value={0}>{t('settings.security.timeOptions.neverClear')}</option>
              </select>
              <span className="text-sm text-text2">{t('settings.security.clipboardClearSuffix')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Database className="w-5 h-5 mr-2 text-accent" />
          <h3 className="text-lg font-medium">{t('settings.data.title')}</h3>
        </div>
        
        <div className="bg-surface border border-surface2 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{t('settings.data.backup')}</h4>
              <p className="text-sm text-text2">{t('settings.data.backupDesc')}</p>
            </div>
            <button
              onClick={handleBackupDatabase}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>{t('settings.data.backupBtn', '备份')}</span>
            </button>
          </div>

          <div className="border-t border-surface2 pt-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium">{t('settings.data.switch')}</h4>
              <p className="text-sm text-text2">{t('settings.data.switchDesc')}</p>
            </div>
            <button
              onClick={handleSwitchDatabase}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>{t('settings.data.switchBtn', '切换')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 危险操作 */}
      <section>
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 mr-2 text-error" />
          <h3 className="text-lg font-medium text-error">{t('settings.danger.title')}</h3>
        </div>
        
        <div className="bg-error bg-opacity-10 border border-error rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-error">{t('settings.danger.clearData')}</h4>
              <p className="text-sm text-text2">{t('settings.danger.clearDataDesc')}</p>
            </div>
            <button
              onClick={handleClearAllData}
              className="bg-error hover:bg-error/80 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('settings.danger.clearDataBtn', '清空数据')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 语言设置 */}
      <section className="mb-8">
        <div className="flex items-center mb-4">
          <svg className="w-5 h-5 mr-2 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <h3 className="text-lg font-medium">{t('settings.language.title')}</h3>
        </div>
        
        <div className="bg-surface border border-surface2 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{t('settings.language.select')}</h4>
              <p className="text-sm text-text2 mt-1">
                {language === 'zh' ? '当前语言：中文' : 'Current Language: English'}
              </p>
            </div>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="input"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>

      {/* 版本信息 */}
      <div className="mt-12 pt-6 border-t border-surface2 text-center text-sm text-text2">
        <p>Sentinel-Vault v0.2.0</p>
        <p className="mt-1">{t('settings.version.subtitle')}</p>
      </div>
      </div>
    </div>
  );
}
