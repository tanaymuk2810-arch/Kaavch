package com.suraksha.trainer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Teal = Color(0xFF0E7490)
val TealLight = Color(0xFF22A5BF)
val Amber = Color(0xFFFBBF24)
val AmberDark = Color(0xFFB45309)
val SurfaceDark = Color(0xFF10222B)
val SuccessGreen = Color(0xFF15803D)
val ErrorRed = Color(0xFFB91C1C)

private val LightColors = lightColorScheme(
    primary = Teal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFC7E9F0),
    onPrimaryContainer = Color(0xFF0B3D49),
    secondary = AmberDark,
    onSecondary = Color.White,
    surface = Color.White,
    background = Color(0xFFF5FAFB),
    error = ErrorRed
)

private val DarkColors = darkColorScheme(
    primary = TealLight,
    onPrimary = Color(White),
    primaryContainer = Color(0xFF0B3D49),
    onPrimaryContainer = Color(0xFFC7E9F0),
    secondary = Amber,
    onSecondary = Color(0xFF3E2E00),
    surface = SurfaceDark,
    background = SurfaceDark,
    error = Color(0xFFF87171)
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