use serde::{Deserialize, Serialize};
use tauri::command;
use sqlx::Row;
use crate::database::get_db_pool;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: Option<i64>,
    pub name: String,
    pub color: String,
    pub status: String,
    pub description: String,
    pub arch_desc: String,
    pub readme_path: Option<String>,
    pub urls_json: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectWithCount {
    pub id: Option<i64>,
    pub name: String,
    pub color: String,
    pub count: i64,
}

#[command]
pub async fn create_project(project: Project) -> Result<i64, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let result = sqlx::query("INSERT INTO projects (name, color, status, description, arch_desc, readme_path, urls_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&project.name)
        .bind(&project.color)
        .bind(&project.status)
        .bind(&project.description)
        .bind(&project.arch_desc)
        .bind(&project.readme_path)
        .bind(&project.urls_json)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result.last_insert_rowid())
}

#[command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    let rows = sqlx::query("SELECT id, name, color, status, description, arch_desc, readme_path, urls_json FROM projects ORDER BY name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let projects: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(Project {
            id: Some(row.get("id")),
            name: row.get("name"),
            color: row.get("color"),
            status: row.get("status"),
            description: row.get("description"),
            arch_desc: row.get("arch_desc"),
            readme_path: row.get("readme_path"),
            urls_json: row.get("urls_json"),
        })
    }).collect();
    
    projects
}

#[command]
pub async fn update_project(id: i64, project: Project) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    sqlx::query("UPDATE projects SET name = ?, color = ?, status = ?, description = ?, arch_desc = ?, readme_path = ?, urls_json = ? WHERE id = ?")
        .bind(&project.name)
        .bind(&project.color)
        .bind(&project.status)
        .bind(&project.description)
        .bind(&project.arch_desc)
        .bind(&project.readme_path)
        .bind(&project.urls_json)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn delete_project(id: i64) -> Result<(), String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;
    
    // First delete all relations to this project
    sqlx::query("DELETE FROM credential_project_relations WHERE project_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // Then delete the project
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn get_project_counts() -> Result<Vec<ProjectWithCount>, String> {
    let pool = get_db_pool().await.map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT p.id, p.name, p.color, COUNT(r.id) as count FROM projects p LEFT JOIN credential_project_relations r ON p.id = r.project_id GROUP BY p.id ORDER BY p.name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let projects: Result<Vec<_>, _> = rows.iter().map(|row| {
        Ok(ProjectWithCount {
            id: Some(row.get("id")),
            name: row.get("name"),
            color: row.get("color"),
            count: row.get::<i64, _>("count"),
        })
    }).collect();

    projects
}
