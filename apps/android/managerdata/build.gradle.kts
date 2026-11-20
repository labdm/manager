import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "dev.labdm.manager.data"
    compileSdk { version = release(37) }
    buildToolsVersion = "36.0.0"

    defaultConfig {
        minSdk = 26
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

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(project(":managerkit"))

    // Convex's published AAR is not a plain transitive POM dependency.
    implementation("dev.convex:android-convexmobile:0.8.0@aar") {
        isTransitive = true
    }
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.clerk.convex)
    // The bridge brings clerk-android-api; the app supplies clerk-android-ui.

    testImplementation(libs.junit)
}
