package com.suraksha.trainer.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.suraksha.trainer.assessment.AssessmentResult
import com.suraksha.trainer.assessment.Question
import com.suraksha.trainer.assessment.QuestionType
import com.suraksha.trainer.assessment.SubmittedAnswer
import com.suraksha.trainer.core.AppContainer
import com.suraksha.trainer.data.repo.ModuleProgressState
import com.suraksha.trainer.module.L10n
import com.suraksha.trainer.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AssessmentUiState(
    val language: String = "hi",
    val config: com.suraksha.trainer.assessment.AssessmentConfig? = null,
    val questionIndex: Int = 0,
    val answers: Map<String, SubmittedAnswer> = emptyMap(),
    val arEvidence: Map<String, Boolean> = emptyMap(),
    val result: AssessmentResult? = null,
    val arTaskIds: Map<String, String> = emptyMap()
)

class AssessmentViewModel(
    private val container: AppContainer,
    private val moduleId: String
) : ViewModel() {

    private val _state = MutableStateFlow(
        AssessmentUiState(config = container.contentLoader.loadAssessment(moduleId))
    )
    val state: StateFlow<AssessmentUiState> = _state

    init {
        viewModelScope.launch {
            container.workerRepository.getActiveWorker()?.let { w ->
                // Reconstruct real AR evidence from events recorded in the player.
                // A task only counts if the worker completed it correctly there.
                val recentEvents = container.database.trainingDao().recentEvents(500)
                val evidence = mutableMapOf<String, Boolean>()
                container.contentLoader.loadPack(moduleId)?.steps?.forEach { s ->
                    s.arTask?.let { task ->
                        evidence[task.taskId] = recentEvents.any {
                            it.moduleId == moduleId && it.taskId == task.taskId && it.correct
                        }
                    }
                }
                _state.value = _state.value.copy(
                    language = w.language,
                    arEvidence = evidence
                )
            }
        }
    }

    val questions: List<Question> get() = _state.value.config?.questions ?: emptyList()

    fun answerCurrent(answer: SubmittedAnswer) {
        val q = questions.getOrNull(_state.value.questionIndex) ?: return
        val answers = _state.value.answers + (q.id to answer)
        val nextIndex = (_state.value.questionIndex + 1).coerceAtMost(questions.size - 1)
        _state.value = _state.value.copy(answers = answers, questionIndex = nextIndex)
    }

    fun previous() {
        val i = _state.value.questionIndex
        if (i > 0) _state.value = _state.value.copy(questionIndex = i - 1)
    }

    fun next() {
        val i = _state.value.questionIndex
        if (i < questions.size - 1) _state.value = _state.value.copy(questionIndex = i + 1)
    }

    fun submit(onDone: (AssessmentResult) -> Unit) {
        viewModelScope.launch {
            val s = _state.value
            val config = s.config ?: return@launch
            val active = container.workerRepository.getActiveWorker() ?: return@launch
            val result = container.sessionRepository.evaluate(
                workerId = active.id,
                config = config,
                answers = s.answers.values.toList(),
                arEvidence = s.arEvidence
            )
            _state.value = _state.value.copy(result = result)
            // mark all AR evidence questions answered
            onDone(result)
        }
    }
}

fun assessmentViewModelFactory(container: AppContainer, moduleId: String): ViewModelProvider.Factory =
    viewModelFactory { initializer { AssessmentViewModel(container, moduleId) } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssessmentScreen(container: AppContainer, moduleId: String, nav: NavController) {
    val vm: AssessmentViewModel = viewModel(
        key = "assessment_$moduleId",
        factory = assessmentViewModelFactory(container, moduleId)
    )
    val state by vm.state.collectAsState()
    val questions = vm.questions
    val current = questions.getOrNull(state.questionIndex)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.assess_title)) },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                }
            )
        }
    ) { padding ->
        when {
            state.result != null -> {
                val result = state.result
                Column(
                    Modifier
                        .padding(padding)
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        if (result.passed) stringResource(R.string.assess_passed) else stringResource(R.string.assess_failed),
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        stringResource(R.string.assess_score, result.score),
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(Modifier.height(24.dp))
                    if (result.passed) {
                        Button(onClick = { nav.navigate(Routes.certificate(moduleId, result.score)) }) {
                            Text(stringResource(R.string.assess_get_cert))
                        }
                    } else {
                        OutlinedButton(onClick = { nav.popBackStack() }) {
                            Text(stringResource(R.string.assess_review))
                        }
                    }
                }
            }
            current == null -> {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(stringResource(R.string.loading))
                }
            }
            else -> {
                QuestionView(
                    vm = vm, title = stringResource(R.string.assess_question,
                        (state.questionIndex + 1), questions.size),
                    current = current, language = state.language,
                    answer = state.answers[current.id],
                    arEvidence = state.arEvidence,
                    questionIndex = state.questionIndex,
                    questionCount = questions.size,
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun QuestionView(
    vm: AssessmentViewModel,
    title: String,
    current: Question,
    language: String,
    answer: SubmittedAnswer?,
    arEvidence: Map<String, Boolean>,
    questionIndex: Int,
    questionCount: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(8.dp))
        Text(current.prompt.forLang(language), style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(16.dp))

        when (current.type) {
            QuestionType.MC -> {
                current.options.forEachIndexed { index, option ->
                    Surface(
                        onClick = { vm.answerCurrent(SubmittedAnswer(questionId = current.id, choice = index)) },
                        color = if (answer?.choice == index) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Text(option.label.forLang(language), Modifier.padding(16.dp))
                    }
                }
            }
            QuestionType.TRUE_FALSE -> {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Surface(
                        onClick = { vm.answerCurrent(SubmittedAnswer(questionId = current.id, boolValue = true)) },
                        color = if (answer?.boolValue == true) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.yes), Modifier.padding(24.dp), textAlign = TextAlign.Center) }
                    Surface(
                        onClick = { vm.answerCurrent(SubmittedAnswer(questionId = current.id, boolValue = false)) },
                        color = if (answer?.boolValue == false) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.no), Modifier.padding(24.dp), textAlign = TextAlign.Center) }
                }
            }
            QuestionType.SEQ -> {
                var selected by remember { mutableStateOf(answer?.sequence ?: emptyList()) }
                val remaining = current.options.filter { it.id !in selected }
                Text(stringResource(R.string.assess_seq_hint), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                selected.forEachIndexed { i, id ->
                    val opt = current.options.firstOrNull { it.id == id }
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) { Text((i + 1).toString() + ".  " + (opt?.label?.forLang(language) ?: ""), Modifier.padding(12.dp)) }
                }
                remaining.forEach { opt ->
                    Card(onClick = {
                        selected = selected + opt.id
                        vm.answerCurrent(SubmittedAnswer(questionId = current.id, sequence = selected))
                    }, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Text(opt.label.forLang(language), Modifier.padding(12.dp))
                    }
                }
            }
            QuestionType.MATCH -> {
                // Pairing UI accumulates ALL mappings locally, submitting only
                // when every item is paired (avoids advancing mid-question).
                var mapping by remember { mutableStateOf(answer?.mapping ?: emptyMap()) }
                val remaining = current.pairs.keys.count { mapping[it] == null }
                current.pairs.keys.forEach { item ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(item, Modifier.weight(1f))
                        current.options.forEach { opt ->
                            val selected = mapping[item] == opt.id
                            Card(
                                onClick = { mapping = mapping + (item to opt.id) },
                                colors = androidx.compose.material3.CardDefaults.cardColors(
                                    containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surfaceVariant
                                ),
                                modifier = Modifier
                            ) { Text(opt.label.forLang(language), Modifier.padding(8.dp)) }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    if (remaining == 0) stringResource(R.string.assess_match_done)
                    else stringResource(R.string.assess_match_pending, remaining),
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { vm.answerCurrent(SubmittedAnswer(questionId = current.id, mapping = mapping)) },
                    enabled = remaining == 0,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.next)) }
            }
            QuestionType.AR_EVIDENCE -> {
                // Evidence is NOT auto-granted on view. It must have been
                // recorded by completing the AR task correctly in the player.
                val done = current.arTaskId != null && arEvidence[current.arTaskId] == true
                Text(
                    if (done) stringResource(R.string.assess_ar_done) else stringResource(R.string.assess_ar_pending),
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
                if (!done) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.assess_ar_pending_hint),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = { vm.previous() }, modifier = Modifier.fillMaxWidth()) {
                        Text(stringResource(R.string.back))
                    }
                } else {
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = { vm.answerCurrent(SubmittedAnswer(questionId = current.id)) },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(stringResource(R.string.next)) }
                }
            }
        }

        Spacer(Modifier.height(24.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (questionIndex > 0) {
                OutlinedButton(onClick = { vm.previous() }) { Text(stringResource(R.string.back)) }
            }
            if (questionIndex == questionCount - 1) {
                Button(onClick = { vm.submit { result -> } }) { Text(stringResource(R.string.assess_submit)) }
            }
        }
    }
}