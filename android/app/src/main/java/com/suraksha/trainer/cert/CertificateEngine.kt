package com.suraksha.trainer.cert

import android.content.Context
import android.graphics.Bitmap
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.google.zxing.BarcodeFormat
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.journeyapps.barcodescanner.BarcodeEncoder
import com.suraksha.trainer.core.Config
import com.suraksha.trainer.data.db.AppDatabase
import com.suraksha.trainer.data.db.entity.CertificateEntity
import com.suraksha.trainer.data.db.entity.WorkerEntity
import java.security.KeyPair
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64
import java.util.UUID

/**
 * Generates signed, QR-encoded certificates entirely on-device.
 *
 * Chain of trust (tamper-evidence without a network):
 *   certNo      = short sha256(fields without certNo)
 *   chainHash   = sha256(prevCert.chainHash || payload)  — a lightweight
 *                 blockchain-style hash-chain over the on-device ledger.
 *   signature   = ECDSA-SHA256 over payload, key held in Android Keystore
 *   QR          = domain|...|pubKey|signature  (11 pipe-separated parts)
 */
class CertificateEngine(
    private val context: Context,
    private val db: AppDatabase
) {
    private val keystoreAlias = "suraksha-worker-signing-key"
    private val payloadSeparator = "|"

    suspend fun generate(
        worker: WorkerEntity,
        moduleId: String,
        titleKey: String,
        score: Int
    ): CertificateEntity {
        val id = UUID.randomUUID().toString()
        val issuedAt = System.currentTimeMillis()
        val prev = runCatching { db.certificateDao().latest() }.getOrNull()
        val prevHash = prev?.chainHash?.takeIf { it.isNotBlank() } ?: HASH_GENESIS

        // certNo is derived from a provisional payload WITHOUT the certNo field,
        // then the signed payload uses the FINAL certNo. This keeps the payload
        // fully deterministic so verifyLocally() can rebuild it exactly from the
        // QR fields (chain hash and signature would otherwise never match).
        val provisionalPayload = buildPayload("", worker.id, moduleId, score, issuedAt, worker.siteName)
        val payloadHash = sha256(provisionalPayload).uppercase().take(12).chunked(4).joinToString("-")
        val certNo = "SRK-" + worker.id.take(4).uppercase() + "-" + payloadHash
        val payload = buildPayload(certNo, worker.id, moduleId, score, issuedAt, worker.siteName)
        val chainHash = sha256(prevHash + payloadSeparator + payload)
        val keyPair = obtainKeyPair()
        val signature = sign(keyPair, payload)

        return CertificateEntity(
            id = id,
            certNo = certNo,
            workerId = worker.id,
            moduleId = moduleId,
            score = score,
            issuedAt = issuedAt,
            siteName = worker.siteName,
            signedData = payload,
            signature = Base64.getEncoder().encodeToString(signature),
            publicKey = Base64.getEncoder().encodeToString(keyPair.public.encoded),
            prevHash = prevHash,
            chainHash = chainHash,
            chainVerified = false,
            revoked = false
        )
    }

    /** Machine-readable payload appended to the QR. */
    fun qrText(cert: CertificateEntity): String = buildString {
        append(Config.HASH_CHAIN_DOMAIN)
        append(payloadSeparator).append(cert.certNo)
        append(payloadSeparator).append(cert.workerId)
        append(payloadSeparator).append(cert.moduleId)
        append(payloadSeparator).append(cert.score)
        append(payloadSeparator).append(cert.issuedAt)
        append(payloadSeparator).append(cert.siteName)
        append(payloadSeparator).append(cert.prevHash)
        append(payloadSeparator).append(cert.chainHash)
        append(payloadSeparator).append(cert.publicKey)
        append(payloadSeparator).append(cert.signature)
    }

    fun encodeQr(text: String, size: Int = 512): Bitmap? = runCatching {
        val matrix: BitMatrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
        BarcodeEncoder().createBitmap(matrix)
    }.getOrNull()

    /** Local offline verification (chain + signature + on-device ledger lookup). */
    suspend fun verifyLocally(qrText: String): VerificationResult = runCatching {
        val parts = qrText.split(payloadSeparator)
        require(parts.size == 11 && parts[0] == Config.HASH_CHAIN_DOMAIN)
        val certNo = parts[1]
        val payload = buildPayload(
            certNo = certNo,
            workerId = parts[2],
            moduleId = parts[3],
            score = parts[4].toInt(),
            issuedAt = parts[5].toLong(),
            siteName = parts[6]
        )
        val chain = sha256(parts[7] + payloadSeparator + payload)
        val chainOk = chain == parts[8]
        val pubKey = Base64.getDecoder().decode(parts[9])
        val signature = Base64.getDecoder().decode(parts[10])
        val sigOk = verify(pubKey, payload, signature)
        when {
            !chainOk -> VerificationResult.INVALID_CHAIN
            !sigOk -> VerificationResult.INVALID_SIGNATURE
            else -> {
                val ledger = db.certificateDao().getByCertNo(certNo) ?: return@runCatching VerificationResult.NOT_IN_LEDGER
                if (ledger.revoked) VerificationResult.REVOKED else VerificationResult.VALID
            }
        }
    }.getOrDefault(VerificationResult.INVALID_FORMAT)

    // --- internals ---

    private fun buildPayload(
        certNo: String,
        workerId: String,
        moduleId: String,
        score: Int,
        issuedAt: Long,
        siteName: String
    ): String = "${Config.HASH_CHAIN_DOMAIN}$payloadSeparator$certNo$payloadSeparator" +
        "$workerId$payloadSeparator$moduleId$payloadSeparator$score$payloadSeparator" +
        "$issuedAt$payloadSeparator$siteName"

    // --- internals ---

    private fun sha256(input: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private fun obtainKeyPair(): KeyPair {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(keystoreAlias, null) as? java.security.PrivateKey)?.let { privateKey ->
            val pub = ks.getCertificate(keystoreAlias)?.publicKey
            if (pub != null) return KeyPair(pub, privateKey)
        }
        val generator = java.security.KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
        )
        generator.initialize(
            KeyGenParameterSpec.Builder(
                keystoreAlias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        return generator.generateKeyPair()
    }

    private fun sign(keyPair: KeyPair, data: String): ByteArray {
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initSign(keyPair.private)
        sig.update(data.toByteArray(Charsets.UTF_8))
        return sig.sign()
    }

    private fun verify(publicSpki: ByteArray, data: String, signature: ByteArray): Boolean = runCatching {
        val keyFactory = java.security.KeyFactory.getInstance("EC")
        val spec = java.security.spec.X509EncodedKeySpec(publicSpki)
        val pub = keyFactory.generatePublic(spec)
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initVerify(pub)
        sig.update(data.toByteArray(Charsets.UTF_8))
        sig.verify(signature)
    }.getOrDefault(false)

    enum class VerificationResult { VALID, INVALID_CHAIN, INVALID_SIGNATURE, REVOKED, NOT_IN_LEDGER, INVALID_FORMAT }

    companion object {
        val HASH_GENESIS = "GENESIS-" + "0".repeat(64)
    }
}