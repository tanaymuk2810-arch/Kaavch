package com.suraksha.trainer.core

import android.content.Context
import com.suraksha.trainer.assessment.AssessmentEngine
import com.suraksha.trainer.cert.CertificateEngine
import com.suraksha.trainer.data.db.AppDatabase
import com.suraksha.trainer.data.repo.ModuleRepository
import com.suraksha.trainer.data.repo.SessionRepository
import com.suraksha.trainer.data.repo.WorkerRepository
import com.suraksha.trainer.module.ModuleContentLoader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Manual DI container (keeps the app dependency-light for mid-range devices). */
class AppContainer(context: Context) {

    val appContext: Context = context.applicationContext

    val database: AppDatabase by lazy { AppDatabase.build(appContext) }

    val contentLoader: ModuleContentLoader by lazy { ModuleContentLoader(appContext) }

    val workerRepository: WorkerRepository by lazy { WorkerRepository(database) }

    val moduleRepository: ModuleRepository by lazy { ModuleRepository(database) }

    val assessmentEngine: AssessmentEngine by lazy { AssessmentEngine() }

    val certificateEngine: CertificateEngine by lazy { CertificateEngine(appContext, database) }

    val sessionRepository: SessionRepository by lazy {
        SessionRepository(database, workerRepository, moduleRepository, assessmentEngine, certificateEngine)
    }

    val exportManager: ExportManager by lazy { ExportManager(database) }

    private val bootScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Called from MainActivity: seeds the offline module catalog on first launch. */
    fun boot() {
        bootScope.launch {
            moduleRepository.seedCatalogIfEmpty()
        }
    }
}