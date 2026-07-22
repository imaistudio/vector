plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.compose")
  id("org.jetbrains.kotlin.plugin.serialization")
}

android {
  namespace = "studio.imai.vector"
  compileSdk = 36
  buildToolsVersion = "36.0.0"

  val uploadKeystoreFile = providers.environmentVariable("ANDROID_UPLOAD_KEYSTORE_FILE").orNull
  val uploadKeyAlias = providers.environmentVariable("ANDROID_UPLOAD_KEY_ALIAS").orNull
  val uploadKeyPassword = providers.environmentVariable("ANDROID_UPLOAD_KEY_PASSWORD").orNull
  val uploadStorePassword = providers.environmentVariable("ANDROID_UPLOAD_STORE_PASSWORD").orNull
  val hasUploadSigning = listOf(
    uploadKeystoreFile,
    uploadKeyAlias,
    uploadKeyPassword,
    uploadStorePassword,
  ).all { !it.isNullOrBlank() }

  defaultConfig {
    applicationId = "studio.imai.vector"
    minSdk = 36
    targetSdk = 36
    val suppliedVersionCode = providers.environmentVariable("VECTOR_ANDROID_VERSION_CODE").orNull
    versionCode = suppliedVersionCode?.takeIf { it.isNotBlank() }?.let { raw ->
      requireNotNull(raw.toIntOrNull()) { "VECTOR_ANDROID_VERSION_CODE must be a positive integer." }
        .also { require(it > 0) { "VECTOR_ANDROID_VERSION_CODE must be a positive integer." } }
    } ?: 1
    versionName = providers.environmentVariable("VECTOR_ANDROID_VERSION_NAME").orNull?.takeIf { it.isNotBlank() } ?: "1.0"

    testInstrumentationRunner = "studio.imai.vector.VectorTestRunner"
    vectorDrawables.useSupportLibrary = true
  }

  signingConfigs {
    if (hasUploadSigning) {
      create("upload") {
        storeFile = file(requireNotNull(uploadKeystoreFile))
        keyAlias = uploadKeyAlias
        keyPassword = uploadKeyPassword
        storePassword = uploadStorePassword
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      if (hasUploadSigning) {
        signingConfig = signingConfigs.getByName("upload")
      }
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  packaging {
    resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2025.06.01")
  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.activity:activity-compose:1.10.1")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.datastore:datastore-preferences:1.1.7")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("dev.convex:android-convexmobile:0.8.0@aar") {
    isTransitive = true
  }

  debugImplementation("androidx.compose.ui:ui-tooling")
  debugImplementation("androidx.compose.ui:ui-test-manifest")

  testImplementation("junit:junit:4.13.2")
  testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
  testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")

  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
