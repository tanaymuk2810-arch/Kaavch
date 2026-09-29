package com.suraksha.trainer.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import com.suraksha.trainer.R
import com.suraksha.trainer.cert.CertificateEngine
import com.suraksha.trainer.cert.QrDecoder
import com.suraksha.trainer.core.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class VerifyViewModel(private val container: AppContainer) : ViewModel() {
    private val _result = MutableStateFlow<Pair<String, CertificateEngine.VerificationResult>?>(null)
    val result: StateFlow<Pair<String, CertificateEngine.VerificationResult>?> = _result

    fun verify(qrText: String) {
        viewModelScope.launch {
            _result.value = qrText to container.sessionRepository.verifyQr(qrText)
        }
    }

    fun clear() { _result.value = null }
}

fun verifyViewModelFactory(container: AppContainer): ViewModelProvider.Factory =
    viewModelFactory { initializer { VerifyViewModel(container) } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerifyScreen(container: AppContainer, nav: NavController) {
    val vm: VerifyViewModel = viewModel(factory = verifyViewModelFactory(container))
    val ctx = LocalContext.current
    var hasCamera by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var manualInput by remember { mutableStateOf("") }
    val result by vm.result.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCamera = granted }

    LaunchedEffect(hasCamera) {
        if (!hasCamera) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.verify_title)) },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
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
                .padding(16.dp)
        ) {
            if (hasCamera) {
                Card(Modifier.fillMaxWidth()) {
                    AndroidView(
                        factory = { viewCtx ->
                            PreviewView(viewCtx).apply {
                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(360.dp)
                    ) { previewView ->
                        val providerFuture = ProcessCameraProvider.getInstance(ctx)
                        providerFuture.addListener({
                            runCatching {
                                val cameraProvider = providerFuture.get()
                                val preview = Preview.Builder().build().also {
                                    it.surfaceProvider = previewView.surfaceProvider
                                }
                                val analysis = ImageAnalysis.Builder()
                                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                    .build()
                                analysis.setAnalyzer(
                                    ctx.mainExecutor,
                                    QrDecoder { text -> vm.verify(text) }
                                )
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    (ctx as androidx.activity.ComponentActivity),
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    analysis
                                )
                            }
                        }, ctx.mainExecutor)
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    stringResource(R.string.verify_title),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            } else {
                Text(stringResource(R.string.ar_permission_title))
            }

            Spacer(Modifier.height(16.dp))
            result?.let { (text, res) ->
                val (label, color) = when (res) {
                    CertificateEngine.VerificationResult.VALID -> R.string.verify_valid to MaterialTheme.colorScheme.primary
                    CertificateEngine.VerificationResult.REVOKED -> R.string.verify_revoked to MaterialTheme.colorScheme.error
                    else -> R.string.verify_invalid to MaterialTheme.colorScheme.error
                }
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(label), style = MaterialTheme.typography.titleMedium, color = color)
                        Text(text.take(160), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = manualInput,
                onValueChange = { manualInput = it },
                label = { Text("QR text") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { vm.verify(manualInput.trim()) },
                modifier = Modifier.fillMaxWidth()
            ) { Text(stringResource(R.string.settings_verify_qr)) }
        }
    }
}