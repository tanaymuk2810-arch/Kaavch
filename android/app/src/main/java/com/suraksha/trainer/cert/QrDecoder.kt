package com.suraksha.trainer.cert

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.nio.ByteBuffer

/**
 * CameraX + ZXing QR decoder for in-app certificate verification.
 * Works fully offline.
 */
class QrDecoder(
    private val onDecoded: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private var armed = true

    private val reader = MultiFormatReader().apply {
        setHints(
            mapOf(
                DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
                DecodeHintType.TRY_HARDER to true
            )
        )
    }

    override fun analyze(image: ImageProxy) {
        if (!armed) {
            image.close()
            return
        }
        val plane = image.planes.firstOrNull { it.pixelStride == 1 }
        if (plane != null) {
            val buffer: ByteBuffer = plane.buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            val source = PlanarYUVLuminanceSource(
                bytes,
                image.width,
                image.height,
                0, 0, image.width, image.height,
                false
            )
            val result = runCatching {
                reader.decodeWithState(BinaryBitmap(HybridBinarizer(source)))
            }.getOrNull()
            if (result != null) {
                armed = false
                onDecoded(result.text)
                image.close()
                return
            }
            reader.reset()
        } else {
            // Unsupported pixel format for this pass — skip frame.
        }
        image.close()
    }
}