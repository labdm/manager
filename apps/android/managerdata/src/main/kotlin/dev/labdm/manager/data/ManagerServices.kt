package dev.labdm.manager.data

import android.content.Context
import com.clerk.convex.createClerkConvexClient
import dev.convex.android.AuthState
import dev.convex.android.ConvexClientWithAuth
import dev.labdm.manager.kit.AppConfiguration
import dev.labdm.manager.kit.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * The signed-in Convex client and the board backend that uses it.
 *
 * Mirrors `ManagerServices` in `Packages/ManagerData`: `clerk-convex-kotlin`
 * binds Clerk session changes (including sign-out) to `ConvexClientWithAuth`,
 * so the app never forwards bearer tokens itself. Convex/Clerk types stay
 * behind this module; the app sees only [SessionStatus] and [backend].
 */
class ManagerServices(
    configuration: AppConfiguration,
    context: Context,
) {
    private val appContext = context.applicationContext

    // `Clerk.initialize(...)` must run before this constructor.
    private val client: ConvexClientWithAuth<String> = createClerkConvexClient(
        deploymentUrl = configuration.deploymentUrl,
        context = appContext,
    )

    val backend: ConvexTaskBackend = ConvexTaskBackend(client)

    val sessionUpdates: Flow<SessionStatus> = client.authState.map { state ->
        when (state) {
            is AuthState.Authenticated -> SessionStatus.SIGNED_IN
            is AuthState.AuthLoading -> SessionStatus.LOADING
            is AuthState.Unauthenticated -> SessionStatus.SIGNED_OUT
        }
    }

    /** Clears both the Clerk session and Convex auth state. */
    suspend fun signOut() {
        client.logout(appContext)
    }
}
