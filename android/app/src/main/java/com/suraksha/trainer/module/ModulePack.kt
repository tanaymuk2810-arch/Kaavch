package com.suraksha.trainer.module

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A trilingual text block inside a module pack. */
@Serializable
data class L10n(
    @SerialName("en") val en: String,
    @SerialName("hi") val hi: String,
    @SerialName("sat") val sat: String
) {
    fun forLang(language: String): String = when (language) {
        "hi" -> hi
        "sat" -> sat
        else -> en
    }
}

@Serializable
data class Narration(
    @SerialName("en") val en: String? = null,
    @SerialName("hi") val hi: String? = null,
    @SerialName("sat") val sat: String? = null
) {
    fun forLang(language: String): String? = when (language) {
        "hi" -> hi
        "sat" -> sat
        else -> en
    }
}

/** One complete training module loaded from a bundled JSON content pack. */
@Serializable
data class ModulePack(
    @SerialName("moduleId") val moduleId: String,
    @SerialName("title") val title: L10n,
    @SerialName("subtitle") val subtitle: L10n,
    @SerialName("version") val version: Int = 1,
    @SerialName("passMark") val passMark: Int = 80,
    @SerialName("steps") val steps: List<ContentStep>
)

@Serializable
data class ContentStep(
    @SerialName("id") val id: String,
    @SerialName("type") val type: StepType,
    @SerialName("audio") val audio: Narration? = null,
    @SerialName("task") val arTask: ArTaskSpec? = null,    // when type == AR
    @SerialName("static") val staticBlock: StaticBlock? = null // when type == STATIC
)

@Serializable
data class ArTaskSpec(
    @SerialName("taskId") val taskId: String,
    @SerialName("instruction") val instruction: L10n,
    @SerialName("correctAsset") val correctAsset: String,   // e.g. models/extinguisher.glb
    @SerialName("distractors") val distractors: List<String> = emptyList(),
    @SerialName("scale") val scale: Float = 1.0f
)

@Serializable
data class StaticBlock(
    @SerialName("title") val title: L10n,
    @SerialName("body") val body: L10n
)

@Serializable
enum class StepType {
    @SerialName("STATIC") STATIC,
    @SerialName("AR") AR
}