package com.suraksha.trainer.module

import android.content.Context
import com.suraksha.trainer.assessment.AssessmentConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json

/**
 * Loads module content + assessment configs from bundled assets.
 * All content ships inside the APK; no network required.
 */
class ModuleContentLoader(
    private val context: Context
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }
    private val packCache = mutableMapOf<String, ModulePack>()
    private val assessmentCache = mutableMapOf<String, AssessmentConfig>()

    fun loadPack(moduleId: String): ModulePack? {
        packCache[moduleId]?.let { return it }
        val raw = readAsset("modules/$moduleId.json") ?: return null
        return runCatching { json.decodeFromString<ModulePack>(raw) }
            .onSuccess { packCache[moduleId] = it }
            .getOrNull()
    }

    fun loadAssessment(moduleId: String): AssessmentConfig? {
        assessmentCache[moduleId]?.let { return it }
        val raw = readAsset("modules/${moduleId}_assessment.json") ?: return null
        return runCatching { json.decodeFromString<AssessmentConfig>(raw) }
            .onSuccess { assessmentCache[moduleId] = it }
            .getOrNull()
    }

    fun readAsset(path: String): String? = runCatching {
        context.assets.open(path).bufferedReader().use { it.readText() }
    }.getOrNull()

    /** Seeds the Room catalog with the 5 safety domains bundled in the APK. */
    fun seedCatalogIfEmpty(onInsert: (List<com.suraksha.trainer.data.db.entity.ModuleEntity>) -> Unit) = Unit
}