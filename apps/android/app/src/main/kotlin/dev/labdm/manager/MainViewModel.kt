package dev.labdm.manager

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.labdm.manager.data.ManagerServices
import dev.labdm.manager.kit.SessionStatus
import dev.labdm.manager.kit.TaskBoardModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Holds the board for the session and maps Clerk/Convex auth state into the UI. */
class MainViewModel(
    private val services: ManagerServices,
) : ViewModel() {

    val sessionState: StateFlow<SessionStatus> = services.sessionUpdates.stateIn(
        scope = viewModelScope,
        started = SharingStarted.Eagerly,
        initialValue = SessionStatus.LOADING,
    )

    val board = TaskBoardModel(services.backend)

    /** The bridge signs out of Clerk and clears Convex auth together. */
    fun signOut() {
        viewModelScope.launch {
            services.signOut()
        }
    }

    override fun onCleared() {
        board.stop()
        super.onCleared()
    }

    class Factory(
        private val application: Application,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val app = application as ManagerApplication
            val services = requireNotNull(app.services) {
                app.setupMessage ?: "Manager services are not initialized."
            }
            return MainViewModel(services) as T
        }
    }
}
