package studio.imai.vector

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
  @get:Rule val compose = createEmptyComposeRule()
  private lateinit var scenario: ActivityScenario<MainActivity>

  @Before fun launchSignedOut() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    check(EncryptedSessionStore(context).load() == null)
    scenario = ActivityScenario.launch(MainActivity::class.java)
  }

  @After fun closeActivity() { scenario.close() }

  @Test fun signedOutLaunchShowsSetup() {
    compose.waitUntil(timeoutMillis = 5_000) {
      compose.onAllNodesWithTag("setup-screen").fetchSemanticsNodes().isNotEmpty()
    }
    compose.onNodeWithTag("setup-screen").assertIsDisplayed()
  }
}
