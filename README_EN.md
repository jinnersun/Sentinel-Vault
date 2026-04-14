# Sentinel-Vault

Developer Credentials & Asset Manager - One-stop management for API Keys, servers, databases, and project credentials

> 🌍 [中文版](README.md) | English Version

## Features

### Core Features
- 🔑 **API Keys Management** - Securely store and manage various API keys
- 🖥️ **Infrastructure Assets** - Manage server and database connection information
- 🌐 **Domain Management** - Manage domain assets with RDAP auto-sync for expiry information
- 🔒 **SSL Certificate Management** - Upload, parse, and manage SSL certificates with automatic domain association
- 📁 **Project Center** - Project dashboard displaying architecture, README, and associated resources
- 🛡️ **Security Center** - Unified management of all credentials and asset expiry reminders
- 🔒 **Secure Storage** - AES-256-GCM encryption, local storage with no cloud upload
- 📥 **Chrome Import** - Support importing credentials from Chrome password manager
- 🔍 **Smart Search** - Quickly find credentials and assets

### UI/UX
- 🎨 Dark theme design
- 📱 Responsive three-column layout
- ⚡ Keyboard shortcuts (Ctrl+K search, Ctrl+L lock)
- 🎯 One-click copy SSH commands, database connection strings
- 👁️ Password masking display
- 🔒 Manual lock button and shortcut

### Security Center Features
- ⏰ **Expiry Reminders** - API Keys, servers, databases, domains, SSL certificate expiry reminders
- 🔄 **Rotation Reminders** - Password periodic rotation reminders
- 🔴 **Alert Aggregation** - Sidebar real-time display of pending alert count
- 📊 **Overview Statistics** - Categorized statistics of asset security status
- 🔗 **Topology Alerts** - Abnormal impact chain display, intuitively view certificate/domain expiration impact on servers

### Domain & Certificate Management
- 🌐 **Domain Management** - Registrar, expiry time, associated servers and certificates
- 🔒 **SSL Certificates** - Upload PEM format certificates, automatic domain info parsing
- 🔗 **Auto Association** - Certificates automatically associate with matching domains
- 📋 **Certificate Operations** - Support copying certificate, private key, certificate chain content
- 🔄 **RDAP Sync** - Auto-sync domain registration info and expiry time

### Security
- 🔐 AES-256-GCM encrypted storage
- 🔑 Argon2 password hashing
- 🔒 Stealth mode protection
- 🛡️ Local storage, data never leaves your device

## Quick Start

### Requirements
- Node.js 18+
- Rust 1.70+

### Clone Repository
```bash
git clone https://github.com/jinnersun/Sentinel-Vault.git
cd Sentinel-Vault
```

### Install Dependencies
```bash
npm install
```

### Development Mode
```bash
npm run tauri dev
```

### Build Release
```bash
npm run tauri build
```

## Feature Completion Status

Refer to [SECURITY_CENTER_PLAN.md](docs/SECURITY_CENTER_PLAN.md) planning document:

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Basic Security Center (rotation reminders, API expiry) | ✅ Complete |
| Phase 2 | Server/Database lease management | ✅ Complete |
| Phase 3 | Domain management | ✅ Complete |
| Phase 4 | SSL certificate management | ✅ Complete |
| Extended | RDAP domain info sync | ✅ Complete |
| Extended | Certificate file copy/download | ✅ Complete |
| Extended | Topology alerts (impact chain) | ✅ Complete |
| Extended | Domain-Server association management | ✅ Complete |

## Project Structure

```
devvault/
├── src/                     # Frontend (React + TypeScript)
│   ├── components/         # React components
│   │   ├── ProjectDashboard.tsx    # Project dashboard
│   │   ├── ProjectRelations.tsx    # Project resource manager
│   │   ├── InfrastructureView.tsx  # Infrastructure assets
│   │   └── ...
│   ├── contexts/           # React Context
│   ├── hooks/              # Custom Hooks
│   ├── lib/                # Utility functions
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands.rs     # Tauri commands
│   │   ├── database.rs     # Database operations
│   │   └── crypto.rs       # Encryption features
│   └── migrations/         # Database migration files
└── docs/                   # Development docs (added to .gitignore)
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Rust + Tauri 2.0
- **Database**: SQLite (sqlx)
- **UI Icons**: Lucide React
- **Encryption**: ring crate (AES-256-GCM)

## End-to-End Testing Checklist

### 1. Project Center Testing
- [ ] Create/Edit/Delete projects
- [ ] Project dashboard display (architecture diagram, README rendering)
- [ ] Project resource explorer (Servers/Databases/API Keys categorized display)

### 2. Credentials Management Testing
- [ ] Vault entry CRUD (passwords, API Keys, connection strings)
- [ ] Chrome password import
- [ ] Smart copy feature (SSH commands, database connection strings)

### 3. Infrastructure Assets Testing
- [ ] Server asset CRUD (with lease fields)
- [ ] Database asset CRUD (with lease fields)
- [ ] Server associated domains display
- [ ] Server associated certificate status display

### 4. Domain Management Testing
- [ ] Domain CRUD
- [ ] Domain-Server association/de-association
- [ ] RDAP info sync (registrar, expiry time)
- [ ] Domain card display associated servers and certificates

### 5. SSL Certificate Management Testing
- [ ] Certificate upload (PEM format)
- [ ] Certificate auto-parse domains (SAN)
- [ ] Certificate detail display deployment servers
- [ ] Certificate content copy (cert/private key/chain)

### 6. Security Center Testing
- [ ] Topology alert view (impact chain expand/collapse)
- [ ] Expiry reminder statistics (servers/databases/domains/certificates)
- [ ] Sidebar alert number reminder
- [ ] Overview page asset statistics

### 7. Security Features Testing
- [ ] App startup password verification
- [ ] Stealth mode toggle
- [ ] Manual lock (button and Ctrl+L)
- [ ] Auto-lock feature

## Recent Updates

### v0.2.0 - Multi-language Internationalization Support
- 🌐 **Complete Internationalization** - All UI text supports bilingual (Chinese/English)
- 🔄 **Language Switching** - Settings page supports real-time language switching with auto-save preferences
- 📝 **README Multi-language** - Cross-navigation links between Chinese and English versions
- ✨ **100% Coverage** - All 19 components completed internationalization replacement
- 🌍 **i18next Integration** - Using react-i18next + i18next-browser-languagedetector

### v2.2 - Fixes & Improvements
- 🔧 **Fixed Password Verification** - Fixed app startup password verification logic error
- 🔧 **Fixed Detail Refresh** - Fixed right panel not refreshing after editing
- ✨ **Manual Lock** - Added lock button and Ctrl+L shortcut

### v2.1 - Security Center & Domain/Certificate Management
- ✨ **Security Center** - Unified management of all asset expiry and rotation reminders
- ✨ **Topology Alerts** - Impact chain display, intuitively view impact scope
- ✨ **Domain Management** - Independent domain asset management with RDAP auto-sync
- ✨ **Domain-Server Association** - Bidirectional association management, card display
- ✨ **SSL Certificate Management** - Certificate upload, parsing, auto domain association
- ✨ **Certificate Deployment Info** - Detail page shows certificate deployment server list
- ✨ **Expiry Reminders** - Support API Keys, servers, databases, domains, certificate expiry
- ✨ **Certificate Operations** - Support copying certificate content to clipboard

### v2.0 - Infrastructure Asset Management
- ✨ Added server and database asset management
- ✨ Project dashboard supports displaying architecture, README
- ✨ Project resource explorer categorizes Servers/Databases/API Keys
- ✨ Unsaved changes prompt mechanism
- ✨ Chrome password import feature

## License

MIT License
