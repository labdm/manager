import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

// Public config only. Environment overrides local.properties overrides blank.
// The same keys the Apple client reads are accepted for parity.
val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

fun configValue(property: String, vararg environmentKeys: String): String {
    val fromEnvironment = environmentKeys.firstNotNullOfOrNull { key ->
        providers.environmentVariable(key).orNull?.takeIf { it.isNotBlank() }
    }
    val fromGradleProperty = providers.gradleProperty(property).orNull?.takeIf { it.isNotBlank() }
    return fromEnvironment
        ?: fromGradleProperty
        ?: localProperties.getProperty(property)?.trim()?.takeIf { it.isNotBlank() }
        ?: ""
}

val managerConvexUrl = configValue(
    "manager.convex.url",
    "MANAGER_CONVEX_URL",
    "CONVEX_URL",
)
val managerClerkPublishableKey = configValue(
    "manager.clerk.publishableKey",
    "MANAGER_CLERK_PUBLISHABLE_KEY",
    "CLERK_PUBLISHABLE_KEY",
)
val managerVersionName = configValue(
    "manager.versionName",
    "MANAGER_VERSION_NUMBER",
).ifBlank { "0.1.0" }
val managerVersionCode = configValue(
    "manager.versionCode",
    "MANAGER_VERSION_CODE",
).toIntOrNull() ?: 1

fun javaString(value: String): String =
    "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "dev.labdm.manager"
    compileSdk { version = release(37) }
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "dev.labdm.manager"
        minSdk = 26
        targetSdk = 36
        versionCode = managerVersionCode
        versionName = managerVersionName

        buildConfigField("String", "MANAGER_CONVEX_URL", javaString(managerConvexUrl))
        buildConfigField("String", "MANAGER_CLERK_PUBLISHABLE_KEY", javaString(managerClerkPublishableKey))
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(project(":managerkit"))
    implementation(project(":managerdata"))

    implementation(libs.clerk.ui)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.icons)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.core.ktx)

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation(libs.junit)
}

// Unit tests stay runnable without local config; anything that produces an
// installable app fails early with actionable instructions instead.
val checkManagerConfig = tasks.register("checkManagerConfig") {
    group = "verification"
    description = "Checks that the public Convex URL and Clerk publishable key are configured."
    doLast {
        val problems = buildList {
            if (managerConvexUrl.isBlank()) {
                add("Missing Convex URL. Copy apps/android/local.properties.example to apps/android/local.properties or set MANAGER_CONVEX_URL.")
            }
            if (managerClerkPublishableKey.isBlank()) {
                add("Missing Clerk publishable key. Set manager.clerk.publishableKey in local.properties or MANAGER_CLERK_PUBLISHABLE_KEY.")
            }
            if (managerClerkPublishableKey.contains("sk_", ignoreCase = true)) {
                add("A Clerk secret key (sk_*) was supplied. This app only accepts a publishable pk_* key.")
            }
        }
        if (problems.isNotEmpty()) throw GradleException(problems.joinToString("\n"))
    }
}

val packagingTasks = setOf(
    "assemble",
    "assembleDebug",
    "assembleRelease",
    "bundleRelease",
    "installDebug",
    "installRelease",
)
tasks.matching { it.name in packagingTasks }.configureEach { dependsOn(checkManagerConfig) }
