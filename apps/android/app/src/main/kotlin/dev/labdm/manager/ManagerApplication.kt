package dev.labdm.manager

import android.app.Application
import com.clerk.api.Clerk
import dev.labdm.manager.data.ManagerServices
import dev.labdm.manager.kit.AppConfiguration

/**
 * Initializes Clerk and the Convex client once per process.
 *
 * Missing public config is not fatal at startup: the UI shows a setup screen
 * with the same instructions as the Apple client instead of crashing.
 */
class ManagerApplication : Application() {
    var services: ManagerServices? = null
        private set
    var setupMessage: String? = null
        private set

    override fun onCreate() {
        super.onCreate()

        val configuration = try {
            AppConfiguration(
                deploymentUrl = BuildConfig.MANAGER_CONVEX_URL,
                clerkPublishableKey = BuildConfig.MANAGER_CLERK_PUBLISHABLE_KEY,
            )
        } catch (error: IllegalArgumentException) {
            setupMessage = error.message ?: "Manager is not configured."
            return
        }

        // The Clerk/Convex bridge binds session changes during construction,
        // so Clerk must be initialized first.
        Clerk.initialize(context = this, publishableKey = configuration.clerkPublishableKey)
        services = ManagerServices(configuration = configuration, context = this)
    }
}
