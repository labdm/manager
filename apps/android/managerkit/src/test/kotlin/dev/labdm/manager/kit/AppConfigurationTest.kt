package dev.labdm.manager.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigurationTest {
    @Test
    fun `accepts public production config`() {
        val config = AppConfiguration(
            deploymentUrl = "https://example.convex.cloud",
            clerkPublishableKey = "pk_live_abc123",
        )
        assertEquals("example.convex.cloud", config.deploymentHost)
    }

    @Test
    fun `allows http only on loopback`() {
        AppConfiguration("http://127.0.0.1:3210", "pk_test_abc")
        assertTrue(runCatching {
            AppConfiguration("http://example.com", "pk_test_abc")
        }.exceptionOrNull()?.message?.contains("https") == true)
    }

    @Test
    fun `rejects missing config with actionable message`() {
        val error = runCatching { AppConfiguration("", "") }.exceptionOrNull()
        assertTrue(error?.message?.contains("local.properties") == true)
    }

    @Test
    fun `rejects secret keys`() {
        val error = runCatching {
            AppConfiguration("https://example.convex.cloud", "sk_live_secret")
        }.exceptionOrNull()
        assertTrue(error?.message?.contains("pk_") == true)
    }
}
