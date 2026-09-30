package com.suraksha.trainer.ui.navigation

object Routes {
    const val ONBOARDING = "onboarding"
    const val WEBAPP = "webapp"
    const val REGISTER = "register"
    const val HOME = "home"
    const val PROFILE = "profile"
    const val MODULE = "module/{moduleId}"
    const val ASSESSMENT = "assessment/{moduleId}"
    const val CERTIFICATE = "certificate/{moduleId}/{score}"
    const val VERIFY = "verify"

    fun module(moduleId: String) = "module/$moduleId"
    fun assessment(moduleId: String) = "assessment/$moduleId"
    fun certificate(moduleId: String, score: Int) = "certificate/$moduleId/$score"
}