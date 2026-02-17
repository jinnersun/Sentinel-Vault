use tauri::command;

#[command]
pub async fn copy_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 使用 clipboard-win 5.4.x API
        use clipboard_win::set_clipboard_string;
        set_clipboard_string(&text)
            .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        eprintln!("Clipboard not implemented for this platform");
        Ok(())
    }
}

#[command]
pub async fn fetch_favicon(url: String) -> Result<String, String> {
    if url.is_empty() {
        return Ok("https://www.google.com/s2/favicons?domain=example.com&sz=32".to_string());
    }
    
    // Extract domain from URL
    let domain = match url::Url::parse(&url) {
        Ok(parsed_url) => {
            parsed_url.host_str().unwrap_or("example.com").to_string()
        },
        Err(_) => "example.com".to_string(),
    };
    
    Ok(format!("https://www.google.com/s2/favicons?domain={}&sz=32", domain))
}
