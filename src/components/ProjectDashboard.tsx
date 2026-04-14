import { useState, useEffect } from 'react';
import type { Project, ProjectUrl } from '../types';
import api from '../lib/tauri-api';
import { useApp } from '../contexts/AppContext';
import { showUnsavedDialog } from '../hooks/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  Github, 
  ExternalLink, 
  FileText, 
  Loader2, 
  AlertCircle,
  Server,
  Layout,
  Activity,
  Edit2,
  X,
  Check,
  Plus,
  Trash2
} from 'lucide-react';

interface ProjectDashboardProps {
  project: Project;
}

export default function ProjectDashboard({ project }: ProjectDashboardProps) {
  const { t } = useTranslation();
  const { dispatch } = useApp();
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [readmeError, setReadmeError] = useState<string>('');
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [originalForm, setOriginalForm] = useState({
    name: project.name,
    status: project.status,
    description: project.description,
    arch_desc: project.arch_desc,
    readme_path: project.readme_path || '',
    urls: JSON.parse(project.urls_json || '[]') as ProjectUrl[],
  });
  const [editForm, setEditForm] = useState(originalForm);
  const [saving, setSaving] = useState(false);
  
  // 检查是否有未保存的更改
  const isDirty = JSON.stringify(editForm) !== JSON.stringify(originalForm);
  
  // 同步未保存状态和保存回调到全局
  useEffect(() => {
    dispatch({ type: 'SET_UNSAVED_CHANGES', payload: isEditing && isDirty });
    // 注册保存回调
    dispatch({ 
      type: 'SET_SAVE_CALLBACK', 
      payload: isEditing && isDirty ? () => handleSave() : null 
    });
    return () => {
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      dispatch({ type: 'SET_SAVE_CALLBACK', payload: null });
    };
  }, [isEditing, isDirty, dispatch]);

  const urls: ProjectUrl[] = (() => {
    try {
      return JSON.parse(project.urls_json || '[]');
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    if (project.readme_path) {
      loadReadme();
    }
  }, [project.readme_path]);

  const loadReadme = async () => {
    if (!project.readme_path) return;
    setLoadingReadme(true);
    setReadmeError('');
    try {
      const content = await api.readProjectReadme(project.readme_path);
      setReadmeContent(content);
    } catch (error) {
      setReadmeError(t('project.dashboard.readmeLoadFailed'));
      console.error('Failed to load readme:', error);
    } finally {
      setLoadingReadme(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400';
      case 'inactive': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return t('project.dashboard.status.active');
      case 'maintenance': return t('project.dashboard.status.maintenance');
      case 'inactive': return t('project.dashboard.status.inactive');
      default: return status;
    }
  };

  const getUrlIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('github')) return <Github className="w-4 h-4" />;
    if (lower.includes('prod') || lower.includes('生产')) return <Server className="w-4 h-4" />;
    if (lower.includes('dev') || lower.includes('开发')) return <Layout className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const handleSave = async () => {
    if (!project.id) return;
    setSaving(true);
    try {
      await api.updateProject(project.id, {
        ...project,
        name: editForm.name,
        status: editForm.status,
        description: editForm.description,
        arch_desc: editForm.arch_desc,
        readme_path: editForm.readme_path || undefined,
        urls_json: JSON.stringify(editForm.urls),
      });
      // 刷新项目列表
      const projects = await api.getProjects();
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      // 更新原始表单状态
      setOriginalForm(editForm);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save project:', error);
      alert(t('project.dashboard.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (isDirty) {
      const action = await showUnsavedDialog(t('project.dashboard.unsavedChanges'));
      if (action === 'cancel') return;
      if (action === 'save') {
        await handleSave();
        return;
      }
      // action === 'discard'，继续执行取消
    }
    // 重置表单
    setEditForm(originalForm);
    setIsEditing(false);
  };

  const addUrl = () => {
    setEditForm(prev => ({
      ...prev,
      urls: [...prev.urls, { name: '', url: '' }]
    }));
  };

  const updateUrl = (index: number, field: keyof ProjectUrl, value: string) => {
    setEditForm(prev => ({
      ...prev,
      urls: prev.urls.map((u, i) => i === index ? { ...u, [field]: value } : u)
    }));
  };

  const removeUrl = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index)
    }));
  };

  if (isEditing) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{t('project.dashboard.editProject')}</h2>
          <div className="flex items-center space-x-2">
            {isDirty && (
              <span className="text-sm text-warning mr-2">{t('project.dashboard.unsavedIndicator')}</span>
            )}
            <button
              onClick={handleCancel}
              className="btn-secondary btn-sm"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-1" />
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="btn btn-sm"
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              {t('common.save')}
            </button>
          </div>
        </div>

        <div className="space-y-4 max-w-2xl">
          {/* 项目名称 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-1">{t('project.dashboard.projectName')}</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
            />
          </div>

          {/* 项目状态 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-1">{t('project.dashboard.projectStatus')}</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
            >
              <option value="active">{t('project.dashboard.status.active')}</option>
              <option value="maintenance">{t('project.dashboard.status.maintenance')}</option>
              <option value="inactive">{t('project.dashboard.status.inactive')}</option>
            </select>
          </div>

          {/* 项目描述 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-1">{t('project.dashboard.projectDescription')}</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
              placeholder={t('project.dashboard.projectDescriptionPlaceholder')}
            />
          </div>

          {/* 架构描述 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-1">{t('project.dashboard.architectureDescription')}</label>
            <textarea
              value={editForm.arch_desc}
              onChange={(e) => setEditForm(prev => ({ ...prev, arch_desc: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent resize-none"
              placeholder={t('project.dashboard.architectureDescriptionPlaceholder')}
            />
          </div>

          {/* README 路径 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-1">{t('project.dashboard.readmePath')}</label>
            <input
              type="text"
              value={editForm.readme_path}
              onChange={(e) => setEditForm(prev => ({ ...prev, readme_path: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent"
              placeholder={t('project.dashboard.readmePathPlaceholder')}
            />
          </div>

          {/* URL 列表 */}
          <div>
            <label className="block text-sm font-medium text-text2 mb-2">{t('project.dashboard.relatedLinks')}</label>
            <div className="space-y-2">
              {editForm.urls.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={url.name}
                    onChange={(e) => updateUrl(index, 'name', e.target.value)}
                    placeholder={t('project.dashboard.linkName')}
                    className="flex-1 px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent text-sm"
                  />
                  <input
                    type="text"
                    value={url.url}
                    onChange={(e) => updateUrl(index, 'url', e.target.value)}
                    placeholder="URL"
                    className="flex-[2] px-3 py-2 bg-background border border-surface2 rounded-lg focus:outline-none focus:border-accent text-sm"
                  />
                  <button
                    onClick={() => removeUrl(index)}
                    className="p-2 text-error hover:bg-surface2 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addUrl}
                className="flex items-center space-x-1 text-sm text-accent hover:text-accent2"
              >
                <Plus className="w-4 h-4" />
                <span>{t('project.dashboard.addLink')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-surface2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: project.color }}
            >
              {project.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${getStatusColor(project.status)}`}>
                <Activity className="w-3 h-3 mr-1" />
                {getStatusText(project.status)}
              </span>
            </div>
          </div>
          
          {/* 快速链接 */}
          {urls.length > 0 && (
            <div className="flex items-center space-x-2">
              {urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1.5 bg-surface2 hover:bg-surface rounded-lg text-sm transition-colors"
                  title={url.name}
                >
                  {getUrlIcon(url.name)}
                  <span className="max-w-[100px] truncate">{url.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
          
          {/* 编辑按钮 */}
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-sm"
          >
            <Edit2 className="w-4 h-4 mr-1" />
            {t('common.edit')}
          </button>
        </div>
      </div>

      {/* 核心描述区 */}
      <div className="p-6 grid grid-cols-2 gap-6">
        {/* 项目描述 */}
        <div className="bg-surface rounded-lg p-4">
          <h2 className="text-sm font-medium text-text2 uppercase tracking-wider mb-3 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            {t('project.dashboard.projectDescriptionLabel')}
          </h2>
          <div className="text-text whitespace-pre-wrap min-h-[100px]">
            {project.description || t('project.dashboard.noDescription')}
          </div>
        </div>

        {/* 架构描述 */}
        <div className="bg-surface rounded-lg p-4">
          <h2 className="text-sm font-medium text-text2 uppercase tracking-wider mb-3 flex items-center">
            <Layout className="w-4 h-4 mr-2" />
            {t('project.dashboard.architectureDescriptionLabel')}
          </h2>
          <div className="text-text whitespace-pre-wrap min-h-[100px]">
            {project.arch_desc || t('project.dashboard.noArchitecture')}
          </div>
        </div>
      </div>

      {/* README 区域 */}
      {project.readme_path && (
        <div className="px-6 pb-6">
          <div className="bg-surface rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-surface2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text2 uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                README
              </h2>
              <span className="text-xs text-text2">{project.readme_path}</span>
            </div>
            <div className="p-4">
              {loadingReadme ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-text2" />
                </div>
              ) : readmeError ? (
                <div className="flex items-center justify-center py-8 text-error">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {readmeError}
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-text">
                    {readmeContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
