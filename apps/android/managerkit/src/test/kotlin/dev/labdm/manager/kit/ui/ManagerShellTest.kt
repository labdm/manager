package dev.labdm.manager.kit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import dev.labdm.manager.kit.BoardPhase
import dev.labdm.manager.kit.BoardState
import dev.labdm.manager.kit.InMemoryTaskBackend
import dev.labdm.manager.kit.TaskBoardModel
import dev.labdm.manager.kit.TaskItem
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Happy paths for the row-first shell. Robolectric keeps these JVM tests device-free. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ManagerShellTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `Tasks destination renders on a compact screen`() {
        setShell(compact = true)

        composeTestRule.onNodeWithTag("primary-bar").assertIsDisplayed()
        composeTestRule.onNodeWithTag("destination-tasks").assertIsDisplayed()
        composeTestRule.onNodeWithTag("chip-all").assertIsDisplayed()
        composeTestRule.onNodeWithTag("row-task-1").assertIsDisplayed()
        composeTestRule.onNodeWithText("Buy milk").assertIsDisplayed()
        composeTestRule.onNodeWithTag("primary-rail").assertDoesNotExist()
    }

    @Test
    @Config(sdk = [35], qualifiers = "w800dp-h700dp")
    fun `wide detail starts empty`() {
        setShell(compact = false)

        composeTestRule.onNodeWithTag("primary-rail").assertIsDisplayed()
        composeTestRule.onNodeWithTag("primary-bar").assertDoesNotExist()
        composeTestRule.onNodeWithTag("empty-detail").assertIsDisplayed()
        composeTestRule.onNodeWithText("Select an item.").assertIsDisplayed()
        composeTestRule.onNodeWithTag("detail-title").assertDoesNotExist()
    }

    @Test
    @Config(sdk = [35], qualifiers = "w800dp-h700dp")
    fun `selecting a row shows its title in detail`() {
        setShell(compact = false)

        composeTestRule.onNodeWithTag("row-task-1").performClick()
        composeTestRule.waitUntil { hasNode("detail-title") }

        composeTestRule.onNodeWithTag("detail-title").assertIsDisplayed().assertTextEquals("Buy milk")
    }

    @Test
    @Config(sdk = [35], qualifiers = "w800dp-h700dp")
    fun `changing a chip clears the selection`() {
        setShell(compact = false)

        composeTestRule.onNodeWithTag("row-task-1").performClick()
        composeTestRule.waitUntil { hasNode("detail-title") }
        composeTestRule.onNodeWithTag("chip-daily").performClick()
        composeTestRule.waitUntil { !hasNode("detail-title") }

        composeTestRule.onNodeWithTag("empty-detail").assertIsDisplayed()
    }

    @Test
    fun `drawer contains Settings`() {
        setShell(compact = true)

        composeTestRule.onNodeWithTag("menu-button").performClick()
        composeTestRule.waitUntil { hasNode("drawer-Settings") }

        composeTestRule.onNodeWithTag("drawer-Settings").assertIsDisplayed()
        composeTestRule.onNodeWithText("Settings").assertIsDisplayed()
    }

    private fun hasNode(tag: String): Boolean =
        composeTestRule.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()

    private fun setShell(compact: Boolean) {
        val task = TaskItem(id = "1", title = "Buy milk", done = false)
        val model = TaskBoardModel(
            backend = InMemoryTaskBackend(listOf(task)),
            initialState = BoardState(tasks = listOf(task), phase = BoardPhase.Ready),
        )
        val width = if (compact) 400.dp else 800.dp
        composeTestRule.setContent {
            ManagerTheme {
                Box(Modifier.width(width).height(700.dp)) {
                    ManagerShellScreen(
                        model = model,
                        account = {},
                        onSignOut = {},
                    )
                }
            }
        }
        composeTestRule.waitForIdle()
    }
}
