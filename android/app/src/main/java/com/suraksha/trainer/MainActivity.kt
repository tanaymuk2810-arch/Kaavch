package com.suraksha.trainer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.suraksha.trainer.ui.AppRoot
import com.suraksha.trainer.ui.theme.SurakshaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as SurakshaApp).container
        container.boot()
        setContent {
            SurakshaTheme {
                AppRoot(container)
            }
        }
    }
}