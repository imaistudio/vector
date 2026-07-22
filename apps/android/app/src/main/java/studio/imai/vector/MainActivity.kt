package studio.imai.vector

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    val controller = (application as VectorApplication).sessionController
    setContent {
      VectorTheme {
        val state by controller.state.collectAsStateWithLifecycle()
        val error by controller.error.collectAsStateWithLifecycle()
        val busy by controller.busy.collectAsStateWithLifecycle()
        VectorRoot(state, error, busy, controller)
      }
    }
  }
}
