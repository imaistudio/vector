package studio.imai.vector

import android.app.Application
import android.content.Context
import androidx.test.runner.AndroidJUnitRunner

class VectorTestRunner : AndroidJUnitRunner() {
  override fun newApplication(classLoader: ClassLoader?, className: String?, context: Context?): Application =
    super.newApplication(classLoader, TestVectorApplication::class.java.name, context)
}

class TestVectorApplication : VectorApplication() {
  override fun onCreate() {
    check(getSharedPreferences("vector_secure_session", MODE_PRIVATE).edit().clear().commit())
    super.onCreate()
  }
}
