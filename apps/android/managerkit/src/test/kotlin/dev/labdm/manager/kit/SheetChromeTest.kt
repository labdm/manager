package dev.labdm.manager.kit

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Source guards for the sheets-and-bottom-tabs chrome. These pin the structure
 * of the Compose tree without needing an emulator: the root has no rail, the
 * board has no inline form, and the dashboard is a full-screen cover.
 */
class SheetChromeTest {

    private fun source(name: String): String {
        val relative = "src/main/kotlin/dev/labdm/manager/kit/ui/$name"
        val candidates =
            listOf(
                File(relative),
                File("managerkit/$relative"),
                File(System.getProperty("user.dir"), relative),
                File(System.getProperty("user.dir"), "managerkit/$relative"),
            )
        return candidates.first { it.isFile }.readText()
    }

    @Test
    fun `the root has no side rail and uses a bottom bar`() {
        val screen = source("TaskBoardScreen.kt")
        assertFalse(screen.contains("HomeRail"))
        assertFalse(screen.contains("RailButton"))
        assertFalse(screen.contains("MainTabs"))
        assertFalse(screen.contains("Composer("))
        assertTrue(screen.contains("BottomChromeBar"))
        assertTrue(screen.contains("CategoryDashboard"))
        assertTrue(screen.contains("BoardSheetHost"))
    }

    @Test
    fun `the bottom bar carries four slices a grid and a plus`() {
        val bar = source("BottomChromeBar.kt")
        assertTrue(bar.contains("TaskSlice.entries"))
        assertTrue(bar.contains("model.selectSlice(slice)"))
        assertTrue(bar.contains("model.openDashboard()"))
        assertTrue(bar.contains("model.beginTask()"))
        assertTrue(bar.contains("Create a task"))
        assertTrue(bar.contains("Open categories dashboard"))
    }

    @Test
    fun `a create action presents a sheet instead of a form in the column`() {
        val screen = source("TaskBoardScreen.kt")
        assertFalse(screen.contains("OutlinedTextField"))
        assertFalse(screen.contains("TaskEditorDialog"))
        val sheets = source("BoardSheets.kt")
        assertTrue(sheets.contains("ModalBottomSheet"))
        assertTrue(sheets.contains("TaskSheetForm"))
        assertTrue(sheets.contains("EntitySheetForm"))
        assertTrue(sheets.contains("model.createTaskFromSheet"))
    }

    @Test
    fun `the dashboard is a full-screen grid of tiles and not a drawer`() {
        val dashboard = source("CategoryDashboard.kt")
        assertTrue(dashboard.contains("fillMaxSize"))
        assertTrue(dashboard.contains("dashboardTiles"))
        assertTrue(dashboard.contains("selectDashboardTile"))
        assertTrue(dashboard.contains("Add category"))
        assertFalse(dashboard.contains("ModalDrawer"))
        assertFalse(dashboard.contains("NavigationRail"))
    }

    @Test
    fun `appearance uses a searchable grid swatches and a preview`() {
        val picker = source("AppearancePicker.kt")
        assertTrue(picker.contains("IconChoice.search"))
        assertTrue(picker.contains("Appearance.colorTokens"))
        assertTrue(picker.contains("Appearance preview"))
        assertFalse(picker.contains("Icon name"))
        assertFalse(picker.contains("Color token"))

        val sheets = source("BoardSheets.kt")
        assertTrue(sheets.contains("AppearancePicker("))
        for (kind in listOf("Category", "Event", "View", "Progression", "Resource")) {
            assertTrue(sheets.contains("BoardSheet.$kind"))
        }
    }

    @Test
    fun `the task sheet offers check row card and explicit series choices`() {
        val form = source("BoardSheets.kt")
        assertTrue(form.contains("TaskLook.entries"))
        assertTrue(form.contains("SeriesBehavior.entries"))
        assertTrue(form.contains("SeriesCadence.entries"))
        assertTrue(form.contains("series.detail"))
        assertTrue(form.contains("model.createTaskFromSheet"))
    }
}
