package com.suraksha.trainer.data.repo

import com.suraksha.trainer.data.db.AppDatabase
import com.suraksha.trainer.data.db.entity.ModuleEntity
import com.suraksha.trainer.data.db.entity.ModuleProgressEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

class ModuleProgressState(val state: Int, val bestScore: Int, val attempts: Int) {
    companion object {
        const val NOT_STARTED = 0
        const val IN_PROGRESS = 1
        const val PASSED = 2
        const val FAILED = 3
    }
}

class ModuleRepository(private val db: AppDatabase) {

    /** The five mandated safety domains. Bundled always; content packs gate AR steps. */
    fun catalog(): List<ModuleEntity> = listOf(
        ModuleEntity("fire_explosion", "module_fire_title", "FIRE", 80, 1),
        ModuleEntity("gas_confined", "module_gas_title", "GAS", 80, 2),
        ModuleEntity("machinery", "module_machinery_title", "MACHINERY", 80, 3),
        ModuleEntity("ppe", "module_ppe_title", "PPE", 80, 4),
        ModuleEntity("emergency", "module_emergency_title", "EMERGENCY", 80, 5)
    )

    suspend fun seedCatalogIfEmpty() {
        if (db.moduleDao().count() == 0) {
            db.moduleDao().upsertAll(catalog())
        }
    }

    fun observeModules(): Flow<List<ModuleEntity>> = db.moduleDao().observeAll()

    fun observeProgress(workerId: String, moduleId: String): Flow<ModuleProgressEntity?> =
        db.moduleDao().observeProgress(workerId, moduleId)

    fun observeAllProgress(workerId: String): Flow<List<ModuleProgressEntity>> =
        db.moduleDao().observeAllProgress(workerId)

    suspend fun markStarted(workerId: String, moduleId: String) {
        upsertProgress(
            ModuleProgressEntity(
                workerId = workerId,
                moduleId = moduleId,
                state = ModuleProgressState.IN_PROGRESS,
                lastActivityAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun upsertProgress(p: ModuleProgressEntity) = db.moduleDao().upsertProgress(p)

    suspend fun loadProgress(workerId: String, moduleId: String): ModuleProgressEntity? =
        db.moduleDao().observeProgress(workerId, moduleId).first()
}