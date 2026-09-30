package com.suraksha.trainer.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.suraksha.trainer.core.AppContainer
import com.suraksha.trainer.data.repo.WorkerRepository
import com.suraksha.trainer.ui.navigation.Routes
import com.suraksha.trainer.ui.screens.AssessmentScreen
import com.suraksha.trainer.ui.screens.CertificateResultScreen
import com.suraksha.trainer.ui.screens.HomeScreen
import com.suraksha.trainer.ui.screens.ModulePlayerScreen
import com.suraksha.trainer.ui.screens.OnboardingScreen
import com.suraksha.trainer.ui.screens.ProfileScreen
import com.suraksha.trainer.ui.screens.RegisterScreen
import com.suraksha.trainer.ui.screens.VerifyScreen
import com.suraksha.trainer.ui.screens.WebAppScreen

class AppViewModel(private val workerRepo: WorkerRepository) : ViewModel() {
    val activeWorker = workerRepo.observeActiveWorker()
}

fun appViewModelFactory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
    initializer {
        AppViewModel(container.workerRepository)
    }
}

@Composable
fun AppRoot(container: AppContainer) {
    val nav = rememberNavController()
    val vm: AppViewModel = viewModel(factory = appViewModelFactory(container))
    val worker by vm.activeWorker.collectAsState(initial = null)

    NavHost(navController = nav, startDestination = Routes.WEBAPP) {
        composable(Routes.WEBAPP) {
            WebAppScreen()
        }
        composable(Routes.ONBOARDING) {
            OnboardingScreen(nav)
        }
        composable(Routes.REGISTER) {
            RegisterScreen(container, nav)
        }
        composable(Routes.HOME) {
            HomeScreen(container, worker, nav)
        }
        composable(Routes.PROFILE) {
            ProfileScreen(container, worker, nav)
        }
        composable(Routes.MODULE) { entry ->
            val moduleId = entry.arguments?.getString("moduleId") ?: ""
            ModulePlayerScreen(container, moduleId, nav)
        }
        composable(Routes.ASSESSMENT) { entry ->
            val moduleId = entry.arguments?.getString("moduleId") ?: ""
            AssessmentScreen(container, moduleId, nav)
        }
        composable(Routes.CERTIFICATE) { entry ->
            val moduleId = entry.arguments?.getString("moduleId") ?: ""
            val score = entry.arguments?.getString("score")?.toIntOrNull() ?: 0
            CertificateResultScreen(container, moduleId, score, nav)
        }
        composable(Routes.VERIFY) {
            VerifyScreen(container, nav)
        }
    }
}