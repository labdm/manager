package dev.labdm.manager.kit

/**
 * UI-facing auth state. The app never needs to know which SDK produced it.
 *
 * Mirrors the `AuthState` switch in `RootView.swift`, reduced to what the
 * screen actually needs.
 */
enum class SessionStatus {
    LOADING,
    SIGNED_OUT,
    SIGNED_IN,
}
