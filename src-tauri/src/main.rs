// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod crypto;

use database::init_database;
use commands::{
    create_vault_item, get_vault_items, update_vault_item, delete_vault_item,
    create_project, get_projects, search_items,
    copy_to_clipboard, fetch_favicon,
    set_master_password, verify_master_password, has_master_password,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_vault_item,
            get_vault_items,
            update_vault_item,
            delete_vault_item,
            create_project,
            get_projects,
            search_items,
            copy_to_clipboard,
            fetch_favicon,
            set_master_password,
            verify_master_password,
            has_master_password,
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