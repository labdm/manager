// Top-level build file for the standalone Android build.
// This project is intentionally independent of the pnpm workspace at the repo root.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
