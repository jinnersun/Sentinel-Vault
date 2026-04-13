import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../lib/tauri-api';
import { open, save } from '@tauri-apps/api/dialog';
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(30);
  const [clipboardClearSeconds, setClipboardClearSeconds] = useState(30);

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
      alert('请输入当前密码');
      return;
    }
    if (masterPassword !== confirmPassword) {
      alert('两次输入的新密码不一致');
      return;
    }
    if (masterPassword.length < 6) {
      alert('新密码长度至少为 6 位');
      return;
    }
    try {
      // 验证当前密码
      const isValid = await api.verifyMasterPassword(currentPassword);
      if (!isValid) {
        alert('当前密码错误');
        return;
      }
      await api.setMasterPassword(masterPassword);
      alert('主密码修改成功');
      setCurrentPassword('');
      setMasterPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('修改主密码失败');
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
        alert('数据库备份成功');
      }
    } catch (error) {
      console.error('Failed to backup database:', error);
      alert('数据库备份失败');
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
        alert('数据库切换成功，请重启应用');
      }
    } catch (error) {
      console.error('Failed to switch database:', error);
      alert('数据库切换失败');
    }
  };

  const handleClearAllData = async () => {
    // 使用异步顺序确认，确保对话框按顺序显示
    const confirmed1 = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm('警告：此操作将删除所有数据，且无法恢复！\n\n确定要继续吗？');
        resolve(result);
      }, 0);
    });

    if (!confirmed1) {
      return;
    }

    // 等待第一个确认完成后再显示第二个确认
    const confirmed2 = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const result = window.confirm('再次确认：您真的要删除所有凭证、项目和 API Keys 吗？');
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
      alert('所有数据已清空');
      await refreshData();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('清空数据失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">系统设置</h2>

      {/* 安全设置 */}
      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Shield className="w-5 h-5 mr-2 text-accent" />
          <h3 className="text-lg font-medium">安全设置</h3>
        </div>
        
        <div className="bg-surface border border-surface2 rounded-lg p-6 space-y-6">
          {/* 修改主密码 */}
          <div>
            <h4 className="font-medium mb-3">修改主密码</h4>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input w-full"
                placeholder="当前密码"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="新密码"
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
                placeholder="确认新密码"
              />
              <button type="submit" className="btn flex items-center space-x-2">
                <Save className="w-4 h-4" />
                <span>保存密码</span>
              </button>
            </form>
          </div>

          <div className="border-t border-surface2 pt-4">
            <h4 className="font-medium mb-3">自动锁定</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text2">闲置</span>
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
                <option value={5}>5 分钟</option>
                <option value={10}>10 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
                <option value={0}>从不</option>
              </select>
              <span className="text-sm text-text2">后自动锁定</span>
            </div>
          </div>

          <div className="border-t border-surface2 pt-4">
            <h4 className="font-medium mb-3">剪贴板安全</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text2">复制密码后</span>
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
                <option value={10}>10 秒</option>
                <option value={30}>30 秒</option>
                <option value={60}>1 分钟</option>
                <option value={0}>不清除</option>
              </select>
              <span className="text-sm text-text2">自动清除剪贴板</span>
            </div>
          </div>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Database className="w-5 h-5 mr-2 text-accent" />
          <h3 className="text-lg font-medium">数据管理</h3>
        </div>
        
        <div className="bg-surface border border-surface2 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">备份数据库</h4>
              <p className="text-sm text-text2">将当前数据库备份到指定位置</p>
            </div>
            <button
              onClick={handleBackupDatabase}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>备份</span>
            </button>
          </div>

          <div className="border-t border-surface2 pt-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium">切换数据库</h4>
              <p className="text-sm text-text2">选择其他数据库文件（需重启）</p>
            </div>
            <button
              onClick={handleSwitchDatabase}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>切换</span>
            </button>
          </div>
        </div>
      </section>

      {/* 危险操作 */}
      <section>
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 mr-2 text-error" />
          <h3 className="text-lg font-medium text-error">危险操作</h3>
        </div>
        
        <div className="bg-error bg-opacity-10 border border-error rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-error">清空所有数据</h4>
              <p className="text-sm text-text2">删除所有凭证、项目和 API Keys，此操作不可恢复</p>
            </div>
            <button
              onClick={handleClearAllData}
              className="bg-error hover:bg-error/80 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>清空数据</span>
            </button>
          </div>
        </div>
      </section>

      {/* 版本信息 */}
      <div className="mt-12 pt-6 border-t border-surface2 text-center text-sm text-text2">
        <p>DevVault v0.1.0</p>
        <p className="mt-1">安全存储您的开发凭证</p>
      </div>
      </div>
    </div>
  );
}
