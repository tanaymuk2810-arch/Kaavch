package com.suraksha.trainer.core

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.suraksha.trainer.data.db.AppDatabase
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Exports the on-device SQLite data (workers, attempts, certificates) as a
 * single JSON file in the Downloads folder. A site supervisor can copy that
 * file to a PC, where the included web dashboard imports it for reporting and
 * certificate verification — no server required.
 */
class ExportManager(private val db: AppDatabase) {

    private val json = Json { prettyPrint = true; encodeDefaults = true }

    @Serializable
    data class WorkerDto(
        val id: String,
        val name: String,
        val phone: String,
        val siteName: String,
        val district: String,
        val role: String = "worker",
        val createdAt: Long
    )

    @Serializable
    data class AttemptDto(
        val id: String,
        val workerId: String,
        val moduleId: String,
        val score: Int,
        val passed: Boolean,
        val finishedAt: Long
    )

    @Serializable
    data class CertificateDto(
        val id: String,
        val certNo: String,
        val workerId: String,
        val moduleId: String,
        val score: Int,
        val issuedAt: Long,
        val siteName: String,
        val prevHash: String,
        val chainHash: String,
        val revoked: Boolean
    )

    @Serializable
    data class ExportBundle(
        val exportedAt: Long = System.currentTimeMillis(),
        val source: String = "suraksha-trainer/android-sqlite",
        val workers: List<WorkerDto> = emptyList(),
        val attempts: List<AttemptDto> = emptyList(),
        val certificates: List<CertificateDto> = emptyList()
    )

    suspend fun exportAll(): ExportBundle {
        val workers = db.workerDao().all().map {
            WorkerDto(
                id = it.id, name = it.name, phone = it.phone, siteName = it.siteName,
                district = it.district, role = it.role, createdAt = it.createdAt
            )
        }
        val attempts = db.trainingDao().allAttempts().map {
            AttemptDto(
                id = it.id, workerId = it.workerId, moduleId = it.moduleId,
                score = it.score, passed = it.passed, finishedAt = it.finishedAt
            )
        }
        val certificates = db.certificateDao().all().map {
            CertificateDto(
                id = it.id, certNo = it.certNo, workerId = it.workerId, moduleId = it.moduleId,
                score = it.score, issuedAt = it.issuedAt, siteName = it.siteName,
                prevHash = it.prevHash, chainHash = it.chainHash, revoked = it.revoked
            )
        }
        return ExportBundle(workers = workers, attempts = attempts, certificates = certificates)
    }

    /** Writes the export to the shared Downloads folder. Returns a display path. */
    suspend fun writeToDownloads(context: Context): String? {
        val text = json.encodeToString(exportAll())
        val fileName = "kaavach_export_${System.currentTimeMillis()}.json"
        val resolver = context.contentResolver

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, "application/json")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Kaavach")
            }
            val uri: Uri? = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            if (uri == null) return null
            resolver.openOutputStream(uri)?.use { it.write(text.encodeToByteArray()) }
            "Downloads/Kaavach/$fileName"
        } else {
            runCatching {
                val dir = java.io.File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "Kaavach"
                ).apply { mkdirs() }
                java.io.File(dir, fileName).writeText(text)
                "Downloads/Kaavach/$fileName"
            }.getOrNull()
        }
    }
}