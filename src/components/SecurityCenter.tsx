import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock, RefreshCw, Key, Server, Database, Globe, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { SecurityOverview, SecurityAlert } from '../types';
import api from '../lib/tauri-api';

interface SecurityCenterProps {
  onClose: () => void;
}

// 影响链数据结构
interface ImpactChain {
  id: string;
  type: 'certificate' | 'domain' | 'server' | 'database' | 'api_key';
  severity: 'overdue' | 'warning' | 'normal';
  title: string;
  description: string;
  dueDate?: string;
  // 影响范围
  impactedItems: {
    type: string;
    name: string;
    severity?: string;
  }[];
}

const SecurityCenter: React.FC<SecurityCenterProps> = ({ onClose }) => {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [, setAlerts] = useState<SecurityAlert[]>([]);
  const [impactChains, setImpactChains] = useState<ImpactChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'topology' | 'overview'>('topology');
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      const [overviewData, alertsData] = await Promise.all([
        api.getSecurityOverview(),
        api.getSecurityAlerts(),
      ]);
      setOverview(overviewData);
      setAlerts(alertsData);
      
      // 将alerts转换为impactChains格式
      const chains = generateImpactChains(alertsData);
      setImpactChains(chains);
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成影响链数据
  const generateImpactChains = (alerts: SecurityAlert[]): ImpactChain[] => {
    return alerts.map((alert) => ({
      id: `chain-${alert.id}`,
      type: alert.alert_type as any,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      dueDate: alert.due_date,
      impactedItems: [
        { type: alert.item_category, name: alert.title, severity: alert.severity }
      ]
    }));
  };

  // 切换影响链展开状态
  const toggleChain = (chainId: string) => {
    const newExpanded = new Set(expandedChains);
    if (newExpanded.has(chainId)) {
      newExpanded.delete(chainId);
    } else {
      newExpanded.add(chainId);
    }
    setExpandedChains(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'overdue':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'normal':
        return 'text-green-500 bg-green-50 border-green-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'normal':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'certificate':
        return <Shield className="w-4 h-4" />;
      case 'domain':
        return <Globe className="w-4 h-4" />;
      case 'server':
        return <Server className="w-4 h-4" />;
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'api_key':
        return <Key className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTotalAlerts = () => {
    if (!overview) return 0;
    return overview.rotation_overdue + overview.rotation_warning +
           overview.expiry_overdue + overview.expiry_warning;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">安全中心</h1>
              <p className="text-sm text-gray-500">异常聚合器 - 监控证书、域名、服务器到期提醒</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            返回
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {getTotalAlerts() > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">
              发现 {getTotalAlerts()} 个安全问题需要关注
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {[
            { id: 'topology', label: '拓扑告警', icon: AlertTriangle },
            { id: 'overview', label: '概览', icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* 拓扑告警视图 */}
        {activeTab === 'topology' && (
          <div className="space-y-4">
            {impactChains.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p>暂无异常影响链</p>
                <p className="text-sm text-gray-400 mt-2">所有证书、域名、服务器状态正常</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    异常影响链 ({impactChains.length} 个)
                  </h2>
                  <p className="text-sm text-gray-500">
                    点击展开查看完整影响范围
                  </p>
                </div>
                
                {impactChains.map((chain) => (
                  <div
                    key={chain.id}
                    className={`bg-white rounded-lg shadow-sm border overflow-hidden ${
                      chain.severity === 'overdue' ? 'border-red-200' : 
                      chain.severity === 'warning' ? 'border-yellow-200' : 'border-gray-200'
                    }`}
                  >
                    {/* 影响链头部 */}
                    <div
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        getSeverityColor(chain.severity)
                      }`}
                      onClick={() => toggleChain(chain.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedChains.has(chain.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        {getSeverityIcon(chain.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(chain.type)}
                            <span className="font-medium">{chain.title}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              chain.severity === 'overdue' ? 'bg-red-100 text-red-600' :
                              chain.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-green-100 text-green-600'
                            }`}>
                              {chain.severity === 'overdue' ? '已过期' :
                               chain.severity === 'warning' ? '即将到期' : '正常'}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{chain.description}</p>
                          {chain.dueDate && (
                            <p className="text-xs mt-1 opacity-75">
                              到期时间: {chain.dueDate}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* 展开的影响范围 */}
                    {expandedChains.has(chain.id) && chain.impactedItems.length > 0 && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">影响范围:</h4>
                        <div className="space-y-2">
                          {chain.impactedItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 pl-8 py-2"
                            >
                              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                              <span className="text-sm text-gray-500">{item.type}:</span>
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.severity && (
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  item.severity === 'overdue' ? 'bg-red-100 text-red-600' :
                                  item.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                                  'bg-green-100 text-green-600'
                                }`}>
                                  {item.severity === 'overdue' ? '异常' :
                                   item.severity === 'warning' ? '警告' : '正常'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 概览视图 */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={Key}
                label="API Keys"
                value={overview.api_keys_count}
                color="blue"
              />
              <StatCard
                icon={Server}
                label="服务器"
                value={overview.servers_count}
                color="green"
              />
              <StatCard
                icon={Database}
                label="数据库"
                value={overview.databases_count}
                color="purple"
              />
              <StatCard
                icon={Globe}
                label="Chrome凭证"
                value={overview.chrome_count}
                color="orange"
              />
            </div>

            {/* Rotation Status */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                密码轮换状态
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <AlertStat
                  label="已过期"
                  value={overview.rotation_overdue}
                  color="red"
                />
                <AlertStat
                  label="7天内到期"
                  value={overview.rotation_warning}
                  color="yellow"
                />
                <AlertStat
                  label="30天内到期"
                  value={overview.rotation_normal}
                  color="green"
                />
              </div>
            </div>

            {/* Expiry Status */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-500" />
                API 过期状态
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <AlertStat
                  label="已过期"
                  value={overview.expiry_overdue}
                  color="red"
                />
                <AlertStat
                  label="7天内到期"
                  value={overview.expiry_warning}
                  color="yellow"
                />
                <AlertStat
                  label="30天内到期"
                  value={overview.expiry_normal}
                  color="green"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}> = ({ icon: Icon, label, value, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

// Alert Stat Component
const AlertStat: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => {
  const colorClasses: Record<string, string> = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
  };

  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
};

export default SecurityCenter;
