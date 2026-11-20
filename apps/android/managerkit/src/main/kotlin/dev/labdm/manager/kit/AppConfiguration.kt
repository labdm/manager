package dev.labdm.manager.kit

import java.net.URI

/**
 * Public configuration, validated before any SDK is initialized.
 *
 * The app fills this from BuildConfig values generated from `local.properties`
 * or the environment. There are no secrets here: both values are public.
 */
data class AppConfiguration(
    val deploymentUrl: String,
    val clerkPublishableKey: String,
) {
    init {
        validate(deploymentUrl, clerkPublishableKey)
    }

    val deploymentHost: String
        get() = URI.create(deploymentUrl).host ?: deploymentUrl

    companion object {
        private const val LOCAL_CONFIG_HINT =
            "Copy apps/android/local.properties.example to apps/android/local.properties, or set MANAGER_CONVEX_URL / MANAGER_CLERK_PUBLISHABLE_KEY."

        fun validate(deploymentUrl: String, clerkPublishableKey: String) {
            val url = deploymentUrl.trim()
            require(url.isNotEmpty() && !isPlaceholder(url)) {
                "No Convex deployment URL. $LOCAL_CONFIG_HINT"
            }
            val uri = runCatching { URI.create(url) }.getOrNull()
            val scheme = uri?.scheme?.lowercase()
            val host = uri?.host
            require(!host.isNullOrEmpty()) { "The Convex URL is not a valid URL: $url" }
            require(scheme == "https" || (scheme == "http" && isLocal(host))) {
                "The Convex URL must use https (http is allowed for localhost only): $url"
            }

            val key = clerkPublishableKey.trim()
            require(key.isNotEmpty() && !isPlaceholder(key)) {
                "No Clerk publishable key. $LOCAL_CONFIG_HINT"
            }
            require(key.startsWith("pk_test_") || key.startsWith("pk_live_")) {
                "The Clerk key must be a publishable key starting with pk_test_ or pk_live_. Never put an sk_* key in the app."
            }
        }

        private fun isLocal(host: String): Boolean =
            host.equals("localhost", ignoreCase = true) ||
                host == "127.0.0.1" ||
                host == "::1"

        private fun isPlaceholder(value: String): Boolean =
            value.startsWith("\u0024(") || value.startsWith("<") ||
                value.contains("REPLACE_ME", ignoreCase = true) ||
                value.contains("your-deployment", ignoreCase = true)
    }
}
