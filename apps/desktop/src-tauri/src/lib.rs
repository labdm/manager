#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let publishable_key = option_env!("VITE_CLERK_PUBLISHABLE_KEY").unwrap_or("");

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_, _, _| {}));
    }

    builder
        .setup(|_app| {
            #[cfg(all(debug_assertions, target_os = "windows"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                _app.deep_link().register_all()?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_clerk::ClerkPluginBuilder::new()
                .publishable_key(publishable_key)
                .with_tauri_store()
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Manager");
}
