package com.suraksha.trainer.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
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
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.launch

class CertificateViewModel(private val container: AppContainer) : ViewModel() {
    private var issued = false

    suspend fun activeWorker(): WorkerEntity? = container.workerRepository.getActiveWorker()

    suspend fun issue(moduleId: String, titleKey: String, score: Int): CertificateEntity {
        val worker = container.workerRepository.getActiveWorker() ?: error("No worker")
        return container.sessionRepository.issueCertificate(
            workerId = worker.id,
            moduleId = moduleId,
            titleKey = titleKey,
            score = score
        ).also { issued = true }
    }

    fun qrBitmap(cert: CertificateEntity) = container.certificateEngine.encodeQr(
        container.certificateEngine.qrText(cert)
    )

    fun hasIssued(): Boolean = issued
}

fun certificateViewModelFactory(container: AppContainer): ViewModelProvider.Factory =
    viewModelFactory { initializer { CertificateViewModel(container) } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertificateResultScreen(container: AppContainer, moduleId: String, score: Int, nav: NavController) {
    val vm: CertificateViewModel = viewModel(
        key = "cert_$moduleId",
        factory = certificateViewModelFactory(container)
    )
    var cert by remember { mutableStateOf<CertificateEntity?>(null) }
    var worker by remember { mutableStateOf<WorkerEntity?>(null) }
    var error by remember { mutableStateOf(false) }

    LaunchedEffect(moduleId) {
        if (cert == null && !vm.hasIssued()) {
            runCatching {
                val w = vm.activeWorker() ?: error("no worker")
                worker = w
                cert = vm.issue(moduleId, "module_fire_title", score)
            }.onFailure { error = true }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.cert_title)) },
                navigationIcon = {
                    IconButton(onClick = { nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } } }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (error) {
                Text(stringResource(R.string.cert_verify_error))
                Spacer(Modifier.height(12.dp))
                Button(onClick = { nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } } }) { Text(stringResource(R.string.ok)) }
                return@Column
            }
            Text(stringResource(R.string.assess_passed), style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.assess_score, score), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(16.dp))

            if (cert != null) {
                val c = cert!!
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp)) {
                        Text(stringResource(R.string.cert_title), style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(12.dp))
                        Text(stringResource(R.string.cert_issued_to) + ": " + (worker?.name ?: "—"), style = MaterialTheme.typography.bodyLarge)
                        Text(stringResource(R.string.cert_no) + ": " + c.certNo, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            stringResource(R.string.cert_issued_on) + ": " +
                                DateFormat.getDateInstance().format(Date(c.issuedAt)),
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(stringResource(R.string.cert_site) + ": " + c.siteName, style = MaterialTheme.typography.bodyMedium)
                        HorizontalDivider(Modifier.padding(vertical = 12.dp))
                        Text(stringResource(R.string.cert_scan_qr), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(8.dp))
                        vm.qrBitmap(c)?.let { bmp ->
                            Image(
                                bitmap = bmp.asImageBitmap(),
                                contentDescription = "certificate QR",
                                modifier = Modifier
                                    .size(240.dp)
                                    .align(Alignment.CenterHorizontally)
                            )
                        }
                        Spacer(Modifier.height(12.dp))
                        Text(
                            stringResource(R.string.cert_generated_offline),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
                Spacer(Modifier.height(20.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceEvenly) {
                    OutlinedButton(onClick = { nav.navigate(Routes.VERIFY) }) {
                        Text(stringResource(R.string.settings_verify_qr))
                    }
                    Button(onClick = { nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } } }) {
                        Text(stringResource(R.string.finish))
                    }
                }
            } else {
                Text(stringResource(R.string.loading))
            }
        }
    }
}