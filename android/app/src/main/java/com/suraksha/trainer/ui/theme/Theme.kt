package com.suraksha.trainer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand palette (mirrors the web dashboard tokens).
val Teal = Color(0xFF0B2545)
val TealLight = Color(0xFF4E7396)
val Amber = Color(0xFFD9A566)
val AmberDark = Color(0xFFC97B5A)
val SurfaceDark = Color(0xFF04101E)
val SuccessGreen = Color(0xFF7A9B76)
val ErrorRed = Color(0xFFC17B72)

private val LightColors = lightColorScheme(
    primary = Teal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD3DEEB),
    onPrimaryContainer = Color(0xFF071A30),
    secondary = AmberDark,
    onSecondary = Color.White,
    surface = Color.White,
    background = Color(0xFFF5F6F8),
    error = ErrorRed
)

private val DarkColors = darkColorScheme(
    primary = TealLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF143A52),
    onPrimaryContainer = Color(0xFFD3DEEB),
    secondary = Amber,
    onSecondary = Color(0xFF3E2E00),
    surface = SurfaceDark,
    background = SurfaceDark,
    error = Color(0xFFC17B72)
)

@Composable
fun SurakshaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content
    )
}