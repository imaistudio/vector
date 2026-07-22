package studio.imai.vector

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val VectorAccent = Color(0xFF0891B2)
val VectorMuted = Color(0xFF64748B)
val VectorBorder = Color(0xFFE2E8F0)

private val LightColors = lightColorScheme(
  primary = VectorAccent,
  onPrimary = Color.White,
  background = Color(0xFFFDFDFD),
  surface = Color(0xFFFDFDFD),
  surfaceVariant = Color(0xFFF1F5F9),
  outline = VectorBorder,
  error = Color(0xFFDC2626),
)

private val DarkColors = darkColorScheme(
  primary = Color(0xFF22D3EE),
  background = Color(0xFF0B0D10),
  surface = Color(0xFF0B0D10),
  surfaceVariant = Color(0xFF171A20),
  outline = Color(0xFF2B3038),
  error = Color(0xFFF87171),
)

private val VectorTypography = Typography(
  titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
  titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
  titleSmall = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
  bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
  bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
  bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 17.sp),
  labelLarge = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium),
  labelMedium = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
  labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 15.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun VectorTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
    typography = VectorTypography,
    content = content,
  )
}

val MonoStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 15.sp)
