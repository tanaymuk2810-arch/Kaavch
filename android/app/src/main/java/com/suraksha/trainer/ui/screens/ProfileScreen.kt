package com.suraksha.trainer.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
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
import com.suraksha.trainer.data.db.entity.WorkerEntity
import com.suraksha.trainer.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ProfileViewModel(private val container: AppContainer) : ViewModel() {
    private val _worker = MutableStateFlow<WorkerEntity?>(null)
    val worker: StateFlow<WorkerEntity?> = _worker

    private val _certs = MutableStateFlow<List<CertificateEntity>>(emptyList())
    val certs: StateFlow<List<CertificateEntity>> = _certs

    private val _exportInfo = MutableStateFlow<String?>(null)
    val exportInfo: StateFlow<String?> = _exportInfo

    init {
        viewModelScope.launch {
            _worker.value = container.workerRepository.getActiveWorker()
            _worker.value?.id?.let { id ->
                container.sessionRepository.observeCertificates(id).collect { _certs.value = it }
            }
        }
    }

    fun export(androidContext: android.content.Context) {
        viewModelScope.launch {
            _exportInfo.value = container.exportManager.writeToDownloads(androidContext)
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            container.workerRepository.clearActiveWorker()
            onDone()
        }
    }
}

fun profileViewModelFactory(container: AppContainer): ViewModelProvider.Factory =
    viewModelFactory { initializer { ProfileViewModel(container) } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(container: AppContainer, worker: WorkerEntity?, nav: NavController) {
    val vm: ProfileViewModel = viewModel(factory = profileViewModelFactory(container))
    val w by vm.worker.collectAsState(initial = null)
    val certs by vm.certs.collectAsState(initial = emptyList())
    val exportInfo by vm.exportInfo.collectAsState(initial = null)
    val context = LocalContext.current
    var confirmLogout by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.profile_title)) },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .statusBarsPadding(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                w?.let { data ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text(data.name, style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.profile_phone) + ": " + data.phone, style = MaterialTheme.typography.bodyLarge)
                            Text(stringResource(R.string.profile_site) + ": " + data.siteName, style = MaterialTheme.typography.bodyLarge)
                            Text(stringResource(R.string.profile_district) + ": " + data.district, style = MaterialTheme.typography.bodyLarge)
                            Text(stringResource(R.string.profile_language) + ": " + data.language, style = MaterialTheme.typography.bodyLarge)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                stringResource(R.string.online),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.export_title), style = MaterialTheme.typography.titleMedium)
                        Text(
                            stringResource(R.string.export_hint),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(onClick = { vm.export(context) }, modifier = Modifier.fillMaxWidth()) {
                            Text(stringResource(R.string.export_action))
                        }
                        exportInfo?.let {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                stringResource(R.string.export_done) + " " + it,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
            item {
                Text(stringResource(R.string.home_my_certificates), style = MaterialTheme.typography.titleMedium)
            }
            items(certs, key = { it.id }) { c ->
                Card(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { nav.navigate(Routes.VERIFY) }
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(c.certNo, style = MaterialTheme.typography.titleMedium)
                            Text(
                                stringResource(R.string.cert_score) + ": " + c.score + "%", style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                stringResource(R.string.cert_chain_verified),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
            item {
                if (!confirmLogout) {
                    OutlinedButton(
                        onClick = { confirmLogout = true },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(stringResource(R.string.profile_logout)) }
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedButton(onClick = { confirmLogout = false }, modifier = Modifier.weight(1f)) {
                            Text(stringResource(R.string.cancel))
                        }
                        OutlinedButton(
                            onClick = { vm.logout { nav.navigate(Routes.ONBOARDING) { popUpTo(0) { inclusive = true } } } },
                            modifier = Modifier.weight(1f)
                        ) { Text(stringResource(R.string.yes)) }
                    }
                    Text(
                        stringResource(R.string.profile_logout_confirm),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}