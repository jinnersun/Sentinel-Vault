use std::process;
use devvault::database;

async fn print_counts() -> Result<(), String> {
    let pool = database::get_db_pool().await.map_err(|e| e.to_string())?;

    let proj_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let rel_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM credential_project_relations")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let import_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chrome_imported_passwords")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("projects={}; relations={}; imports={}", proj_count, rel_count, import_count);
    Ok(())
}

#[tokio::main]
async fn main() {
    if let Err(e) = database::init_database().await {
        eprintln!("Migration failed: {}", e);
        process::exit(1);
    }
    println!("Migrations applied successfully.");
    if let Err(e) = print_counts().await {
        eprintln!("Verification failed: {}", e);
        process::exit(1);
    }
}
