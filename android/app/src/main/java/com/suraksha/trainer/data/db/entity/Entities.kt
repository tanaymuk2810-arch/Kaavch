package com.suraksha.trainer.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** A worker (trainee) registered on-device. One worker is "active" at a time. */
@Entity(tableName = "workers")
data class WorkerEntity(
    @PrimaryKey val id: String,
    val name: String,
    val phone: String,
    val siteName: String,
    val district: String,
    val language: String,
    val role: String = "worker",
    val isActive: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "sites")
data class SiteEntity(
    @PrimaryKey val id: String,
    val name: String,
    val district: String,
    val company: String,
    val dgmsRegNo: String = ""
)

/** Catalog of training modules (domain, title key, pass mark). */
@Entity(tableName = "modules")
data class ModuleEntity(
    @PrimaryKey val moduleId: String,
    val titleKey: String,
    val domain: String,
    val passMark: Int,
    val sortOrder: Int,
    val version: Int = 1
)

/** Per-worker progress on a module. */
@Entity(tableName = "module_progress", primaryKeys = ["workerId", "moduleId"])
data class ModuleProgressEntity(
    val workerId: String,
    val moduleId: String,
    val state: Int,        // 0 = NOT_STARTED, 1 = IN_PROGRESS, 2 = PASSED, 3 = FAILED
    val bestScore: Int = 0,
    val attempts: Int = 0,
    val lastActivityAt: Long = System.currentTimeMillis()
)

/** One completed assessment attempt (kept even when offline). */
@Entity(tableName = "training_attempts")
data class TrainingAttemptEntity(
    @PrimaryKey val id: String,
    val workerId: String,
    val moduleId: String,
    val score: Int,
    val passed: Boolean,
    val startedAt: Long,
    val finishedAt: Long,
    val answersJson: String,
    val synced: Boolean = false
)

/** AR interaction event captured during training (engagement analytics). */
@Entity(tableName = "ar_events")
data class ArEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val workerId: String,
    val moduleId: String,
    val stepId: String,
    val taskId: String,
    val correct: Boolean,
    val latencyMs: Long,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * A signed certificate. `chainHash` binds this certificate to the ledger
 * (sha256(prevHash || payload)) once synced server-side.
 */
@Entity(tableName = "certificates")
data class CertificateEntity(
    @PrimaryKey val id: String,
    val certNo: String,
    val workerId: String,
    val moduleId: String,
    val score: Int,
    val issuedAt: Long,
    val siteName: String,
    val signedData: String,      // base64 signature input payload
    val signature: String,       // base64 ECDSA signature
    val publicKey: String,       // base64 X.509 SPKI public key
    val prevHash: String = "",
    val chainHash: String = "",
    val chainVerified: Boolean = false,
    val revoked: Boolean = false
)