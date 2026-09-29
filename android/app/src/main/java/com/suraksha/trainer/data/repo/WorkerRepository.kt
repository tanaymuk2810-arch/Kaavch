package com.suraksha.trainer.data.repo

import com.suraksha.trainer.data.db.AppDatabase
import com.suraksha.trainer.data.db.entity.SiteEntity
import com.suraksha.trainer.data.db.entity.WorkerEntity

class WorkerRepository(private val db: AppDatabase) {

    suspend fun register(
        name: String,
        phone: String,
        siteName: String,
        district: String,
        language: String
    ): WorkerEntity {
        db.workerDao().clearActive()
        val worker = WorkerEntity(
            id = java.util.UUID.randomUUID().toString(),
            name = name,
            phone = phone,
            siteName = siteName,
            district = district,
            language = language,
            isActive = true
        )
        db.workerDao().upsert(worker)
        return worker
    }

    fun observeActiveWorker(): kotlinx.coroutines.flow.Flow<WorkerEntity?> = db.workerDao().observeActive()

    suspend fun getActiveWorker(): WorkerEntity? = db.workerDao().getActive()

    suspend fun clearActiveWorker() = db.workerDao().clearActive()

    suspend fun sites(): List<SiteEntity> = db.siteDao().getAll()

    suspend fun upsertSites(sites: List<SiteEntity>) = db.siteDao().upsertAll(sites)
}