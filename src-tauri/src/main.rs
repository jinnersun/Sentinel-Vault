// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod crypto;

use database::init_database;
use commands::{
    create_vault_item, get_vault_items, update_vault_item, delete_vault_item,
    create_project, get_projects, update_project, delete_project, search_items,
    create_credential_project_relation, delete_credential_project_relation, get_relations_for_credential,
            get_project_counts,
            get_vault_items_by_project,
            get_unlinked_vault_items,
            delete_relation_by_credential_and_project,
            get_import_records,
            delete_import_record,
            import_record_to_vault,
            create_api_key, get_api_keys, update_api_key, delete_api_key,
            parse_and_compare_csv, process_import_batch, get_vault_history, read_project_readme,
    copy_to_clipboard, fetch_favicon,
    set_master_password, verify_master_password, has_master_password,
    get_setting, update_setting, backup_database, clear_all_data,
    update_vault_item_security, get_security_overview, get_security_alerts,
    upload_certificate, get_certificates, delete_certificate, read_certificate_file,
    copy_certificate_to_clipboard, get_certificate_file_path,
    get_domains, create_domain, update_domain, delete_domain, link_domain_server, unlink_domain_server, get_expiring_domains,
    fetch_domain_info, sync_domain_info,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_vault_item,
            get_vault_items,
            update_vault_item,
            delete_vault_item,
            create_project,
            update_project,
            delete_project,
            create_credential_project_relation,
            delete_credential_project_relation,
            get_relations_for_credential,
            get_projects,
            search_items,
            copy_to_clipboard,
            fetch_favicon,
            set_master_password,
            verify_master_password,
            has_master_password,
            get_project_counts,
            get_vault_items_by_project,
            get_unlinked_vault_items,
            delete_relation_by_credential_and_project,
            get_import_records,
            delete_import_record,
            import_record_to_vault,
            create_api_key,
            get_api_keys,
            update_api_key,
            delete_api_key,
            parse_and_compare_csv,
            process_import_batch,
            get_vault_history,
            read_project_readme,
            get_setting,
            update_setting,
            backup_database,
            clear_all_data,
            update_vault_item_security,
            get_security_overview,
            get_security_alerts,
            upload_certificate,
            get_certificates,
            delete_certificate,
            read_certificate_file,
            copy_certificate_to_clipboard,
            get_certificate_file_path,
            get_domains,
            create_domain,
            update_domain,
            delete_domain,
            link_domain_server,
            unlink_domain_server,
            get_expiring_domains,
            fetch_domain_info,
            sync_domain_info,
        ])
        .setup(|_app| {
            // Initialize database on startup
            tauri::async_runtime::block_on(async {
                if let Err(e) = init_database().await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}