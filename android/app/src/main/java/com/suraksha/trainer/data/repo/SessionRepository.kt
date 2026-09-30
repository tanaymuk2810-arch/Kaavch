package com.suraksha.trainer.data.repo

import com.suraksha.trainer.assessment.AssessmentConfig
import com.suraksha.trainer.assessment.AssessmentEngine
import com.suraksha.trainer.assessment.AssessmentResult
import com.suraksha.trainer.assessment.SubmittedAnswer
import com.suraksha.trainer.cert.CertificateEngine
import com.suraksha.trainer.data.db.AppDatabase
import com.suraksha.trainer.data.db.entity.CertificateEntity
import com.suraksha.trainer.data.db.entity.TrainingAttemptEntity
import kotlinx.coroutines.flow.first
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

class SessionRepository(
    private val db: AppDatabase,
    private val workerRepository: WorkerRepository,
    private val moduleRepository: ModuleRepository,
    private val assessmentEngine: AssessmentEngine,
    private val certificateEngine: CertificateEngine
) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    suspend fun evaluate(
        workerId: String,
        config: AssessmentConfig,
        answers: List<SubmittedAnswer>,
        arEvidence: Map<String, Boolean>
    ): AssessmentResult {
        val result = assessmentEngine.evaluate(config, answers, arEvidence)
        val attempt = TrainingAttemptEntity(
            id = java.util.UUID.randomUUID().toString(),
            workerId = workerId,
            moduleId = config.moduleId,
            score = result.score,
            passed = result.passed,
            startedAt = System.currentTimeMillis() - 60_000,
            finishedAt = result.finishedAt,
            answersJson = json.encodeToString(ListSerializer(SubmittedAnswer.serializer()), answers)
        )
        db.trainingDao().upsertAttempt(attempt)

        // progress merge (timestamp-based: keep the higher of best scores)
        val prev = moduleRepository.loadProgress(workerId, config.moduleId)
        val best = maxOf(prev?.bestScore ?: 0, result.score)
        val newState = if (result.passed) ModuleProgressState.PASSED else ModuleProgressState.FAILED
        val attempts = (prev?.attempts ?: 0) + 1
        moduleRepository.upsertProgress(
            com.suraksha.trainer.data.db.entity.ModuleProgressEntity(
                workerId = workerId,
                moduleId = config.moduleId,
                state = newState,
                bestScore = best,
                attempts = attempts,
                lastActivityAt = result.finishedAt
            )
        )
        return result
    }

    suspend fun issueCertificate(workerId: String, moduleId: String, titleKey: String, score: Int): CertificateEntity {
        val worker = workerRepository.getActiveWorker() ?: error("No active worker")
        // Dedupe: if a certificate for this worker+module was just issued,
        // reuse it so re-entering the result screen cannot mint duplicates.
        val recent = db.certificateDao().recentFor(workerId, moduleId)
        if (recent != null && recent.score == score &&
            System.currentTimeMillis() - recent.issuedAt < REISSUE_WINDOW_MS
        ) {
            return recent
        }
        val cert = certificateEngine.generate(worker, moduleId, titleKey, score)
        db.certificateDao().upsert(cert)
        return cert
    }

    suspend fun certificatesFor(workerId: String): List<CertificateEntity> =
        db.certificateDao().observeForWorker(workerId).first()

    fun observeCertificates(workerId: String): kotlinx.coroutines.flow.Flow<List<CertificateEntity>> =
        db.certificateDao().observeForWorker(workerId)

    suspend fun verifyQr(qrText: String): CertificateEngine.VerificationResult =
        certificateEngine.verifyLocally(qrText)

    companion object {
        /** Window within which a duplicate certificate for the same attempt is ignored. */
        const val REISSUE_WINDOW_MS = 5 * 60 * 1000L
    }
}