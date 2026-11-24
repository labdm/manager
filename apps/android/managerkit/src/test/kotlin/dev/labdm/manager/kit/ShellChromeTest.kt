package dev.labdm.manager.kit

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Source guards for the row-first shell. They pin the chrome structure without
 * an emulator: the old bottom bar, dashboard and sheet host are gone, and the
 * new shell owns the bar, rail, modal drawer, chips and full-screen form.
 */
class ShellChromeTest {

    private fun uiSource(name: String): String = resolve("$UI_BASE/$name").readText()

    private fun domainSource(name: String): String = resolve("$DOMAIN_BASE/$name").readText()

    private fun absent(name: String): Boolean = candidates("$UI_BASE/$name").none(File::isFile)

    private fun resolve(relative: String): File = candidates(relative).first(File::isFile)

    private fun candidates(relative: String): List<File> {
        val root = File(System.getProperty("user.dir") ?: ".")
        return listOf(File(root, "managerkit/$relative"), File(root, relative), File(relative))
    }

    @Test
    fun `old chrome files are gone`() {
        assertTrue(absent("TaskBoardScreen.kt"))
        assertTrue(absent("BottomChromeBar.kt"))
        assertTrue(absent("CategoryDashboard.kt"))
        assertTrue(absent("BoardSheets.kt"))
    }

    @Test
    fun `compact bar and wide rail are exclusive`() {
        val shell = uiSource("ManagerShellScreen.kt")
        assertTrue(shell.contains("maxWidth < 600.dp"))
        assertTrue(shell.contains("NavigationBar"))
        assertTrue(shell.contains("NavigationRail"))
        assertTrue(shell.contains("primary-bar"))
        assertTrue(shell.contains("primary-rail"))
        assertFalse(shell.contains("TaskSlice.entries"))
        assertFalse(shell.contains("openDashboard"))
    }

    @Test
    fun `menu is a modal drawer with the settled rows`() {
        val shell = uiSource("ManagerShellScreen.kt")
        val domain = domainSource("ShellDomain.kt")
        assertTrue(shell.contains("ModalNavigationDrawer"))
        assertFalse(shell.contains("PermanentNavigationDrawer"))
        for (row in listOf(
            "Achievements", "Contacts", "Events", "Routings", "Profile",
            "Settings", "Docs", "Contact us", "Desktop app", "Changelog",
        )) {
            assertTrue(domain.contains("\"$row\""))
        }
    }

    @Test
    fun `one row renders every kind and invites keep both decisions`() {
        val shell = uiSource("ManagerShellScreen.kt")
        assertTrue(shell.contains("ListItem("))
        assertTrue(shell.contains("Accept"))
        assertTrue(shell.contains("Decline"))
        assertFalse(shell.contains("Card("))
        assertFalse(shell.contains("TaskLook.CARD"))
    }

    @Test
    fun `create is a full screen route and keeps series explicit`() {
        val form = uiSource("TaskFormScreen.kt")
        assertTrue(form.contains("Scaffold("))
        assertTrue(form.contains("TopAppBar("))
        assertTrue(form.contains("SeriesBehavior.entries"))
        assertTrue(form.contains("SeriesCadence.entries"))
        assertFalse(form.contains("ModalBottomSheet"))
        assertFalse(form.contains("TaskLook.entries"))
    }

    private companion object {
        const val UI_BASE = "src/main/kotlin/dev/labdm/manager/kit/ui"
        const val DOMAIN_BASE = "src/main/kotlin/dev/labdm/manager/kit"
    }
}
