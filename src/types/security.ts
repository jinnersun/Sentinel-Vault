// 安全中心相关类型定义

// 安全设置（存储在 vault.notes 中的安全相关字段）
export interface SecuritySettings {
  // 轮换提醒
  last_rotated_at?: string;           // ISO 8601 格式
  enable_rotation_reminder?: boolean;
  rotation_reminder_days?: number;    // 默认 90
  
  // API 过期提醒
  api_expires_at?: string;            // ISO 8601 格式
  enable_expiry_alert?: boolean;
  expiry_alert_days?: number;         // 默认 7
}

// 域名
export interface Domain {
  id?: number;
  domain: string;
  registrar?: string;
  registration_date?: string;
  expiry_date?: string;
  enable_expiry_alert: boolean;
  expiry_alert_days: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // 关联数据（查询时填充）
  servers?: ServerInfo[];             // 关联的服务器
  certificates?: CertificateInfo[];   // 关联的证书
}

// SSL 证书
export interface SSLCertificate {
  id?: number;
  cert_name: string;
  domains: string[];                  // 证书包含的域名列表
  issuer?: string;
  issued_at?: string;
  expires_at: string;
  enable_expiry_alert: boolean;
  expiry_alert_days: number;
  cert_file_path?: string;
  key_file_path?: string;
  chain_file_path?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // 关联数据（查询时填充）
  domain_objects?: Domain[];          // 关联的域名对象
}

// 服务器信息（用于关联展示）
export interface ServerInfo {
  id: number;
  title: string;
  ip?: string;
}

// 证书信息（用于关联展示）
export interface CertificateInfo {
  id: number;
  cert_name: string;
  expires_at: string;
}

// 安全概览统计
export interface SecurityOverview {
  total_items: number;
  
  // 轮换提醒
  rotation_overdue: number;           // 已过期需轮换
  rotation_warning: number;           // 7天内需轮换
  rotation_normal: number;            // 30天内需轮换
  
  // 过期提醒
  expiry_overdue: number;             // 已过期
  expiry_warning: number;             // 7天内过期
  expiry_normal: number;              // 30天内过期
  
  // 分类统计
  api_keys_count: number;
  servers_count: number;
  databases_count: number;
  chrome_count: number;
  domains_count: number;
  certificates_count: number;
}

// 安全提醒项
export interface SecurityAlert {
  id: number;
  alert_type: 'rotation' | 'expiry' | 'certificate' | 'domain' | 'server' | 'database';
  severity: 'overdue' | 'warning' | 'normal';
  title: string;
  description: string;
  due_date?: string;
  item_id: number;
  item_category: string;
}

// 服务器资产扩展（包含租期信息）
export interface ServerAssetWithLease {
  ip: string;
  port: number;
  os: string;
  ssh_user?: string;
  description?: string;
  ssh_key?: string;
  ssl_cert_ids?: number[];            // 关联的证书ID列表
  region?: string;
  provider?: string;
  tags?: string[];
  status?: string;
  
  // 租期相关
  server_start_date?: string;
  server_end_date?: string;
  server_is_permanent: boolean;
  server_enable_expiry_alert?: boolean;
  server_expiry_alert_days?: number;
}

// 数据库资产扩展（包含租期信息）
export interface DatabaseAssetWithLease {
  db_type: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  admin_url?: string;
  description?: string;
  
  // 服务租期
  service_start_date?: string;
  service_end_date?: string;
  service_is_permanent?: boolean;
  service_enable_expiry_alert?: boolean;
  service_expiry_alert_days?: number;
}
