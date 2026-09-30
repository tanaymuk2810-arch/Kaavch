package com.suraksha.trainer.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.ExperimentalGetImage
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import com.suraksha.trainer.R
import com.suraksha.trainer.ar.ArSessionController
import com.suraksha.trainer.ar.ArSessionHost
import com.suraksha.trainer.core.AppContainer
import com.suraksha.trainer.data.db.entity.ArEventEntity
import com.suraksha.trainer.module.ArTaskSpec
import com.suraksha.trainer.module.ContentStep
import com.suraksha.trainer.module.ModulePack
import com.suraksha.trainer.module.StepType
import com.suraksha.trainer.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val language: String = "hi",
    val pack: ModulePack? = null,
    val stepIndex: Int = 0,
    val arEvidence: Map<String, Boolean> = emptyMap(),
    val events: List<ArEventEntity> = emptyList()
)

class ModulePlayerViewModel(
    private val container: AppContainer,
    private val moduleId: String
) : ViewModel() {

    private val _state = MutableStateFlow(
        PlayerUiState(language = "hi", pack = container.contentLoader.loadPack(moduleId))
    )
    val state: StateFlow<PlayerUiState> = _state

    val arController = ArSessionController()
    private var workerId: String = ""

    init {
        viewModelScope.launch {
            container.workerRepository.getActiveWorker()?.let { worker ->
                workerId = worker.id
                _state.value = _state.value.copy(language = worker.language)
                container.moduleRepository.markStarted(worker.id, moduleId)
            }
            if (_state.value.pack == null) {
                _state.value = _state.value.copy(pack = container.contentLoader.loadPack(moduleId))
            }
        }
    }

    val steps: List<ContentStep> get() = _state.value.pack?.steps ?: emptyList()

    fun assetPathsFor(task: ArTaskSpec): List<String> =
        listOf(task.correctAsset) + task.distractors

    fun previous() {
        val i = _state.value.stepIndex
        if (i > 0) _state.value = _state.value.copy(stepIndex = i - 1)
    }

    fun next() {
        val i = _state.value.stepIndex
        val total = steps.size
        if (i < total - 1) _state.value = _state.value.copy(stepIndex = i + 1)
    }

    fun recordTaskResult(taskId: String, correct: Boolean, latencyMs: Long) {
        val s = _state.value
        val event = ArEventEntity(
            workerId = workerId,
            moduleId = moduleId,
            stepId = s.pack?.steps?.getOrNull(s.stepIndex)?.id ?: taskId,
            taskId = taskId,
            correct = correct,
            latencyMs = latencyMs
        )
        _state.value = _state.value.copy(
            arEvidence = if (correct) s.arEvidence + (taskId to true) else s.arEvidence,
            events = s.events + event
        )
        if (correct && s.stepIndex < steps.size - 1) {
            next()
        }
    }

    suspend fun commitEvents() {
        if (_state.value.events.isNotEmpty()) {
            container.database.trainingDao().insertEvents(_state.value.events)
            _state.value = _state.value.copy(events = emptyList())
        }
    }
}

fun modulePlayerViewModelFactory(container: AppContainer, moduleId: String): ViewModelProvider.Factory =
    viewModelFactory { initializer { ModulePlayerViewModel(container, moduleId) } }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalGetImage::class)
@Composable
fun ModulePlayerScreen(container: AppContainer, moduleId: String, nav: NavController) {
    val vm: ModulePlayerViewModel = viewModel(
        key = "player_$moduleId",
        factory = modulePlayerViewModelFactory(container, moduleId)
    )
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by vm.state.collectAsState()
    val pack = state.pack
    val steps = vm.steps
    val step = steps.getOrNull(state.stepIndex)

    val hasCameraPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    var arActive by remember { mutableStateOf(hasCameraPermission) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> arActive = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pack?.title?.en ?: moduleId) },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                },
                actions = {
                    Text(
                        stringResource(R.string.ar_progress, (state.stepIndex + 1).coerceAtMost(steps.size), steps.size),
                        modifier = Modifier.padding(end = 12.dp)
                    )
                }
            )
        }
    ) { padding ->
        if (pack == null) {
            Column(
                Modifier
                    .padding(padding)
                    .fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(stringResource(R.string.module_not_installed))
                Spacer(Modifier.height(12.dp))
                Button(onClick = { nav.popBackStack() }) { Text(stringResource(R.string.back)) }
            }
            return@Scaffold
        }

        when (step?.type) {
            StepType.STATIC -> StaticStepView(
                step = step,
                language = state.language,
                onNext = { vm.next() },
                isLast = state.stepIndex == steps.size - 1,
                onComplete = {
                    scope.launch { vm.commitEvents() }
                    nav.navigate(Routes.assessment(moduleId))
                },
                modifier = Modifier.padding(padding)
            )
            StepType.AR -> {
                val task = step.arTask
                if (task == null) {
                    StaticStepView(
                        step, state.language, { vm.next() }, state.stepIndex == steps.size - 1,
                        {
                            scope.launch { vm.commitEvents() }
                            nav.navigate(Routes.assessment(moduleId))
                        },
                        Modifier.padding(padding)
                    )
                } else {
                    ArStepView(
                        vm = vm,
                        step = step,
                        task = task,
                        language = state.language,
                        arActive = arActive,
                        isLast = state.stepIndex == steps.size - 1,
                        onComplete = {
                            scope.launch { vm.commitEvents() }
                            nav.navigate(Routes.assessment(moduleId))
                        },
                        modifier = Modifier.padding(padding)
                    )
                }
            }
            null -> {
                Column(
                    Modifier
                        .padding(padding)
                        .fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Button(
                        onClick = {
                            scope.launch { vm.commitEvents() }
                            nav.navigate(Routes.assessment(moduleId))
                        }
                    ) { Text(stringResource(R.string.assess_title)) }
                }
            }
        }
    }
}

@Composable
private fun StaticStepView(
    step: ContentStep,
    language: String,
    onNext: () -> Unit,
    isLast: Boolean,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val block = step.staticBlock
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.padding(20.dp)) {
                Text(
                    block?.title?.forLang(language).orEmpty(),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    block?.body?.forLang(language).orEmpty(),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
        Spacer(Modifier.height(24.dp))
        if (isLast) {
            Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.assess_title)) }
        } else {
            Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.next)) }
        }
    }
}

@Composable
private fun ArStepView(
    vm: ModulePlayerViewModel,
    step: ContentStep,
    task: com.suraksha.trainer.module.ArTaskSpec,
    language: String,
    arActive: Boolean,
    isLast: Boolean,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    var feedback by remember { mutableStateOf<String?>(null) }
    val startedAt = remember { System.currentTimeMillis() }
    val assetPaths = remember(task) { vm.assetPathsFor(task) }
    val controller = vm.arController

    if (!arActive) {
        // 2D fallback mode for non-ARCore devices: object buttons only
        Column(
            modifier
                .fillMaxSize()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                step.arTask?.instruction?.forLang(language).orEmpty(),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(12.dp))
            Text(
                stringResource(R.string.ar_unsupported),
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(Modifier.height(20.dp))
            assetPaths.forEach { asset ->
                val isCorrect = asset == task.correctAsset
                OutlinedButton(
                    onClick = {
                        vm.recordTaskResult(task.taskId, isCorrect, System.currentTimeMillis() - startedAt)
                        feedback = if (isCorrect) stringResource(R.string.ar_task_correct) else stringResource(R.string.ar_task_wrong)
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(objectLabelFor(asset, language)) }
            }
            feedback?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, style = MaterialTheme.typography.titleMedium)
            }
        }
    } else {
        Column(modifier.fillMaxSize()) {
            ArSessionHost(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                controller = controller
            )
            Column(Modifier.padding(16.dp)) {
                Text(
                    step.arTask?.instruction?.forLang(language).orEmpty(),
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(12.dp))
                LaunchedEffect(task) {
                    controller.placeTask(assetPaths)
                }
                assetPaths.forEach { asset ->
                    val isCorrect = asset == task.correctAsset
                    Button(
                        onClick = {
                            vm.recordTaskResult(task.taskId, isCorrect, System.currentTimeMillis() - startedAt)
                            feedback = if (isCorrect) stringResource(R.string.ar_task_correct) else stringResource(R.string.ar_task_wrong)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) { Text(objectLabelFor(asset, language)) }
                }
                feedback?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, style = MaterialTheme.typography.titleMedium, color = if (it == stringResource(R.string.ar_task_correct)) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                }
                if (isLast) {
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) {
                        Text(stringResource(R.string.assess_title))
                    }
                }
            }
        }
        // place the models for this step as soon as the AR view is up
    }
}

/** Maps an asset filename to a display label (extracted from module content). */
private fun objectLabelFor(asset: String, language: String): String = when {
    asset.contains("extinguisher") -> when (language) {
        "hi" -> "आग बुझाने का यंत्र"; "sat" -> "Sel̃a sirkao"; else -> "Fire extinguisher"
    }
    asset.contains("gas_cylinder") -> when (language) {
        "hi" -> "गैस सिलेंडर"; "sat" -> "Gas silender"; else -> "Gas cylinder"
    }
    asset.contains("safety_sign") -> when (language) {
        "hi" -> "निकास चिह्न"; "sat" -> "Dahra chinh"; else -> "Exit sign"
    }
    asset.contains("helmet") -> when (language) {
        "hi" -> "सुरक्षा हेलमेट"; "sat" -> "Suraksha helmet"; else -> "Safety helmet"
    }
    asset.contains("machinery_guard") -> when (language) {
        "hi" -> "मशीन गार्ड"; "sat" -> "Machine pahira"; else -> "Machinery guard"
    }
    asset.contains("firstaid") -> when (language) {
        "hi" -> "प्राथमिक चिकित्सा किट"; "sat" -> "Boyglu kit"; else -> "First-aid kit"
    }
    else -> asset.substringAfterLast('/')
}