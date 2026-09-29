package com.suraksha.trainer.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Upsert
import com.suraksha.trainer.data.db.entity.ArEventEntity
import com.suraksha.trainer.data.db.entity.CertificateEntity
import com.suraksha.trainer.data.db.entity.ModuleEntity
import com.suraksha.trainer.data.db.entity.ModuleProgressEntity
import com.suraksha.trainer.data.db.entity.SiteEntity
import com.suraksha.trainer.data.db.entity.TrainingAttemptEntity
import com.suraksha.trainer.data.db.entity.WorkerEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WorkerDao {
    @Upsert suspend fun upsert(worker: WorkerEntity)
    @Query("SELECT * FROM workers WHERE id = :id") suspend fun get(id: String): WorkerEntity?
    @Query("SELECT * FROM workers WHERE isActive = 1") fun observeActive(): Flow<WorkerEntity?>
    @Query("SELECT * FROM workers WHERE isActive = 1") suspend fun getActive(): WorkerEntity?
    @Query("UPDATE workers SET isActive = 0") suspend fun clearActive()
    @Query("UPDATE workers SET isActive = 1 WHERE id = :id") suspend fun setActive(id: String)
    @Query("SELECT * FROM workers ORDER BY createdAt DESC") suspend fun all(): List<WorkerEntity>
}

@Dao
interface SiteDao {
    @Upsert suspend fun upsertAll(sites: List<SiteEntity>)
    @Query("SELECT * FROM sites ORDER BY name") suspend fun getAll(): List<SiteEntity>
}

@Dao
interface ModuleDao {
    @Upsert suspend fun upsert(module: ModuleEntity)
    @Upsert suspend fun upsertAll(modules: List<ModuleEntity>)
    @Query("SELECT * FROM modules ORDER BY sortOrder") fun observeAll(): Flow<List<ModuleEntity>>
    @Query("SELECT * FROM modules WHERE moduleId = :id") suspend fun get(id: String): ModuleEntity?
    @Query("SELECT COUNT(*) FROM modules") suspend fun count(): Int

    @Upsert suspend fun upsertProgress(p: ModuleProgressEntity)
    @Query("SELECT * FROM module_progress WHERE workerId = :workerId AND moduleId = :moduleId")
    fun observeProgress(workerId: String, moduleId: String): Flow<ModuleProgressEntity?>
    @Query("SELECT * FROM module_progress WHERE workerId = :workerId")
    fun observeAllProgress(workerId: String): Flow<List<ModuleProgressEntity>>
}

@Dao
interface TrainingDao {
    @Upsert suspend fun upsertAttempt(attempt: TrainingAttemptEntity)
    @Query("SELECT * FROM training_attempts WHERE workerId = :workerId ORDER BY finishedAt DESC")
    fun observeAttempts(workerId: String): Flow<List<TrainingAttemptEntity>>
    @Query("SELECT * FROM training_attempts ORDER BY finishedAt DESC") suspend fun allAttempts(): List<TrainingAttemptEntity>

    @Insert suspend fun insertEvents(events: List<ArEventEntity>)
    @Query("SELECT * FROM ar_events ORDER BY timestamp DESC LIMIT :limit") suspend fun recentEvents(limit: Int = 200): List<ArEventEntity>
}

@Dao
interface CertificateDao {
    @Upsert suspend fun upsert(cert: CertificateEntity)
    @Query("SELECT * FROM certificates WHERE workerId = :workerId ORDER BY issuedAt DESC")
    fun observeForWorker(workerId: String): Flow<List<CertificateEntity>>
    @Query("SELECT * FROM certificates WHERE id = :id") suspend fun get(id: String): CertificateEntity?
    @Query("SELECT * FROM certificates WHERE certNo = :certNo LIMIT 1") suspend fun getByCertNo(certNo: String): CertificateEntity?
    @Query("SELECT * FROM certificates WHERE workerId = :workerId AND moduleId = :moduleId ORDER BY issuedAt DESC LIMIT 1")
    suspend fun recentFor(workerId: String, moduleId: String): CertificateEntity?
    @Query("SELECT * FROM certificates ORDER BY issuedAt DESC LIMIT 1") suspend fun latest(): CertificateEntity?
    @Query("SELECT * FROM certificates ORDER BY issuedAt DESC") suspend fun all(): List<CertificateEntity>
    @Query("SELECT * FROM certificates") fun observeAll(): Flow<List<CertificateEntity>>
}