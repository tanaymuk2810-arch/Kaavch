package com.suraksha.trainer

import android.app.Application
import com.suraksha.trainer.core.AppContainer

class SurakshaApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}