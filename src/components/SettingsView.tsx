import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
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
  useApp(); // 保留 hook 调用
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(30);
  const [clipboardClearSeconds, setClipboardClearSeconds] = useState(30);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    if (masterPassword.length < 6) {
      alert('密码长度至少为 6 位');
      return;
    }
    // TODO: 实现修改主密码
    alert('修改主密码功能开发中');
    setMasterPassword('');
    setConfirmPassword('');
  };

  const handleExportData = () => {
    // TODO: 实现数据导出
    alert('数据导出功能开发中');
  };

  const handleImportData = () => {
    // TODO: 实现数据导入
    alert('数据导入功能开发中');
  };

  const handleClearAllData = () => {
    if (!confirm('警告：此操作将删除所有数据，且无法恢复！\n\n确定要继续吗？')) {
      return;
    }
    if (!confirm('再次确认：您真的要删除所有凭证、项目和 API Keys 吗？')) {
      return;
    }
    // TODO: 实现清空数据
    alert('清空数据功能开发中');
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
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
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
                onChange={(e) => setClipboardClearSeconds(Number(e.target.value))}
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
              <h4 className="font-medium">导出数据</h4>
              <p className="text-sm text-text2">将所有凭证和项目导出为加密文件</p>
            </div>
            <button
              onClick={handleExportData}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>导出</span>
            </button>
          </div>

          <div className="border-t border-surface2 pt-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium">导入数据</h4>
              <p className="text-sm text-text2">从备份文件恢复数据</p>
            </div>
            <button
              onClick={handleImportData}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>导入</span>
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
