package com.suraksha.trainer.assessment

import com.suraksha.trainer.module.L10n
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AssessmentConfig(
    @SerialName("moduleId") val moduleId: String,
    @SerialName("version") val version: Int = 1,
    @SerialName("passMark") val passMark: Int = 80,
    @SerialName("questions") val questions: List<Question>
)

@Serializable
data class Option(
    @SerialName("id") val id: String,
    @SerialName("label") val label: L10n
)

@Serializable
data class Question(
    @SerialName("id") val id: String,
    @SerialName("type") val type: QuestionType,
    @SerialName("prompt") val prompt: L10n,
    @SerialName("points") val points: Int = 1,
    // MC:
    @SerialName("options") val options: List<Option> = emptyList(),
    @SerialName("answer") val answer: Int = -1,          // index of correct MC option
    // TRUE_FALSE:
    @SerialName("answerBool") val answerBool: Boolean = false,
    // SEQ: correct ordering of option ids
    @SerialName("sequence") val sequence: List<String> = emptyList(),
    // MATCH: itemId -> matchedOptionId (pairs are the correct mapping)
    @SerialName("pairs") val pairs: Map<String, String> = emptyMap(),
    // AR evidence: passes if the worker completed this AR task correctly
    @SerialName("arTaskId") val arTaskId: String? = null
)

@Serializable
enum class QuestionType {
    @SerialName("MC") MC,
    @SerialName("TRUE_FALSE") TRUE_FALSE,
    @SerialName("SEQ") SEQ,
    @SerialName("MATCH") MATCH,
    @SerialName("AR_EVIDENCE") AR_EVIDENCE
}

/** JSON-safe submitted answer for one question. */
@Serializable
data class SubmittedAnswer(
    @SerialName("questionId") val questionId: String,
    @SerialName("choice") val choice: Int = -1,                       // MC
    @SerialName("boolValue") val boolValue: Boolean = false,          // TRUE_FALSE
    @SerialName("sequence") val sequence: List<String> = emptyList(), // SEQ
    @SerialName("mapping") val mapping: Map<String, String> = emptyMap() // MATCH
)

@Serializable
data class AssessmentResult(
    @SerialName("moduleId") val moduleId: String,
    @SerialName("score") val score: Int,
    @SerialName("passed") val passed: Boolean,
    @SerialName("correctCount") val correctCount: Int,
    @SerialName("totalQuestions") val totalQuestions: Int,
    @SerialName("perQuestion") val perQuestion: Map<String, Boolean>,
    @SerialName("finishedAt") val finishedAt: Long
)