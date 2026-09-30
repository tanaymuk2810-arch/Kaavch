package com.suraksha.trainer.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import com.suraksha.trainer.R
import com.suraksha.trainer.core.AppContainer
import com.suraksha.trainer.data.db.entity.CertificateEntity
import com.suraksha.trainer.data.db.entity.ModuleEntity
import com.suraksha.trainer.data.db.entity.ModuleProgressEntity
import com.suraksha.trainer.data.db.entity.WorkerEntity
import com.suraksha.trainer.data.repo.ModuleProgressState
import com.suraksha.trainer.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class HomeUiState(
    val workerId: String = "",
    val modules: List<ModuleEntity> = emptyList(),
    val progress: List<ModuleProgressEntity> = emptyList(),
    val certs: List<CertificateEntity> = emptyList()
)

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    private val workerId = MutableStateFlow("")
    val modules: StateFlow<List<ModuleEntity>> = container.moduleRepository.observeModules()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uiState: StateFlow<HomeUiState> = combine(
        workerId,
        container.workerRepository.observeActiveWorker()
    ) { wid, worker ->
        HomeUiState(workerId = worker?.id ?: wid)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), HomeUiState())

    val progressFlow = MutableStateFlow<List<ModuleProgressEntity>>(emptyList())
    val certsFlow = MutableStateFlow<List<CertificateEntity>>(emptyList())

    fun onWorkerReady(worker: WorkerEntity?) {
        worker ?: return
        if (workerId.value == worker.id && progressFlow.value.isNotEmpty()) return
        workerId.value = worker.id
        viewModelScope.launch {
            progressFlow.value = container.moduleRepository.observeAllProgress(worker.id).firstSafe()
            certsFlow.value = container.sessionRepository.observeCertificates(worker.id).firstSafe()
        }
    }
}

private suspend fun <T> kotlinx.coroutines.flow.Flow<T>.firstSafe(): T =
    kotlinx.coroutines.flow.first(this)

fun homeViewModelFactory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
    initializer { HomeViewModel(container) }
}

@Composable
fun HomeScreen(container: AppContainer, worker: WorkerEntity?, nav: NavController) {
    val vm: HomeViewModel = viewModel(factory = homeViewModelFactory(container))
    val modules by vm.modules.collectAsState()
    val state by vm.uiState.collectAsState()
    val progress by vm.progressFlow.collectAsState()
    val certs by vm.certsFlow.collectAsState()

    LaunchedEffect(worker?.id) { vm.onWorkerReady(worker) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.large) {
                    Icon(
                        Icons.Filled.Shield,
                        contentDescription = null,
                        modifier = Modifier.padding(12.dp).size(40.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
                Column(Modifier.padding(start = 12.dp)) {
                    Text(
                        stringResource(R.string.home_greeting, worker?.name ?: "…"),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "${worker?.siteName ?: ""} · ${worker?.district ?: ""}",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        stringResource(R.string.online),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickCard(onClick = { nav.navigate(Routes.PROFILE) }) {
                    Icon(Icons.Filled.Person, stringResource(R.string.home_profile))
                    Text(stringResource(R.string.home_profile))
                }
                QuickCard(onClick = { nav.navigate(Routes.VERIFY) }) {
                    Icon(Icons.Filled.VerifiedUser, stringResource(R.string.settings_verify_qr))
                    Text(stringResource(R.string.settings_verify_qr))
                }
            }
        }

        item { Text(stringResource(R.string.home_your_modules), style = MaterialTheme.typography.titleLarge) }

        items(modules, key = { it.moduleId }) { module ->
            val progressEntry = progress.firstOrNull { it.moduleId == module.moduleId }
            ModuleRow(module, progressEntry) {
                nav.navigate(Routes.module(module.moduleId))
            }
        }

        item {
            Card(onClick = { nav.navigate(Routes.PROFILE) }, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Badge, null, tint = MaterialTheme.colorScheme.primary)
                    Text(
                        "  " + stringResource(R.string.home_my_certificates) + "  (" + certs.size + ")",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickCard(onClick: () -> Unit, content: @Composable () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .weight(1f)
            .padding(vertical = 4.dp)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun ModuleRow(
    module: ModuleEntity,
    progress: ModuleProgressEntity?,
    onClick: () -> Unit
) {
    val state = progress?.state ?: ModuleProgressState.NOT_STARTED
    val stateText = when (state) {
        ModuleProgressState.PASSED -> stringResource(R.string.module_status_passed)
        ModuleProgressState.FAILED -> stringResource(R.string.module_status_failed)
        ModuleProgressState.IN_PROGRESS -> stringResource(R.string.module_status_in_progress)
        else -> stringResource(R.string.module_status_not_started)
    }
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium) {
                Icon(
                    Icons.Filled.Shield,
                    null,
                    modifier = Modifier.padding(10.dp).size(26.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
            Column(Modifier.padding(start = 14.dp)) {
                Text(stringResource(moduleTitleRes(module.titleKey)), style = MaterialTheme.typography.titleMedium)
                Text(
                    stateText,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (state == ModuleProgressState.PASSED) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
                if (state != ModuleProgressState.NOT_STARTED) {
                    Text(
                        stringResource(R.string.module_best, progress?.bestScore ?: 0),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

private fun moduleTitleRes(key: String): Int = when (key) {
    "module_fire_title" -> R.string.module_fire_title
    "module_gas_title" -> R.string.module_gas_title
    "module_machinery_title" -> R.string.module_machinery_title
    "module_ppe_title" -> R.string.module_ppe_title
    "module_emergency_title" -> R.string.module_emergency_title
    else -> R.string.module_ppe_title
}