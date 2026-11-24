package dev.labdm.manager

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.clerk.api.Clerk
import com.clerk.ui.auth.AuthView
import com.clerk.ui.userbutton.UserButton
import dev.labdm.manager.kit.SessionStatus
import dev.labdm.manager.kit.ui.ManagerShellScreen
import dev.labdm.manager.kit.ui.ManagerTheme
import dev.labdm.manager.kit.ui.SetupRequiredScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)

        setContent {
            ManagerTheme {
                val app = application as ManagerApplication
                val setupMessage = app.setupMessage
                if (setupMessage != null) {
                    SetupRequiredScreen(setupMessage)
                    return@ManagerTheme
                }

                val viewModel: MainViewModel = viewModel(factory = MainViewModel.Factory(app))
                val session by viewModel.sessionState.collectAsStateWithLifecycle()

                LaunchedEffect(session) {
                    when (session) {
                        SessionStatus.SIGNED_IN -> viewModel.board.start()
                        else -> viewModel.board.stop()
                    }
                }

                when (session) {
                    SessionStatus.LOADING -> Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }

                    SessionStatus.SIGNED_OUT -> AuthView(
                        isDismissible = false,
                        // Web/desktop use browser OAuth rather than Google One Tap.
                        preferGoogleOneTap = false,
                    )

                    SessionStatus.SIGNED_IN -> ManagerShellScreen(
                        model = viewModel.board,
                        account = { UserButton() },
                        onSignOut = { viewModel.signOut() },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        lifecycleScope.launch {
            intent?.data?.let { Clerk.auth.handle(it) }
        }
    }
}
