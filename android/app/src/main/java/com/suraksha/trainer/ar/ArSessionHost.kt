package com.suraksha.trainer.ar

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner

/**
 * Hosts the live camera feed for AR training steps.
 *
 * CameraX-based 2D AR: the rear camera shows the real surroundings while the
 * placed asset markers float over it and the asset buttons below (in
 * ModulePlayerScreen) record the result. No SceneView/ARCore dependency, so
 * this works on any camera device including non-ARCore phones. All camera
 * calls are defensive (runCatching) so a platform quirk degrades gracefully
 * instead of crashing the module.
 */
@Composable
fun ArSessionHost(
    modifier: Modifier = Modifier,
    controller: ArSessionController
) {
    Box(modifier = modifier) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PreviewView(ctx).apply {
                    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                }.also { previewView ->
                    controller.attachPreview(previewView)
                }
            },
            onRelease = { _ -> controller.detachPreview() }
        )
        if (controller.markers.isNotEmpty()) {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val width = maxWidth
                controller.markers.forEach { marker ->
                    val xFraction = (0.5f + marker.slot * 0.9f).coerceIn(0.05f, 0.95f)
                    Text(
                        text = marker.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .offset(
                                x = ((xFraction - 0.5f) * width.value * 2f * 0.5f).dp,
                                y = 24.dp
                            )
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.85f))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }
    }
}

data class PlacedMarker(
    val assetPath: String,
    val label: String,
    val slot: Float
)

/**
 * Owns the camera session + marker placement. Same public contract as the
 * previous 3D host so callers are untouched: place tasks, clear, and report
 * stability/counts for the AR-evidence question.
 */
class ArSessionController {
    private var cameraProvider: ProcessCameraProvider? = null
    private var started = false
    val markers = mutableStateListOf<PlacedMarker>()

    fun attachPreview(view: PreviewView) {
        startCamera(view)
    }

    fun detachPreview() {
        runCatching { cameraProvider?.unbindAll() }
        cameraProvider = null
        started = false
    }

    private fun startCamera(view: PreviewView) {
        runCatching {
            val ctx: Context = view.context
            val lifecycleOwner = ctx as? LifecycleOwner ?: return
            val providerFuture = ProcessCameraProvider.getInstance(ctx)
            providerFuture.addListener(
                {
                    runCatching {
                        val provider = providerFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.surfaceProvider = view.surfaceProvider
                        }
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview
                        )
                        cameraProvider = provider
                        started = true
                    }
                },
                ContextCompat.getMainExecutor(ctx)
            )
        }
    }

    /**
     * Places one marker per asset path. Slots spread markers horizontally
     * across the preview; the asset buttons below the preview record results.
     */
    fun placeTask(assetPaths: List<String>) {
        markers.clear()
        val slots = listOf(0f, 0.45f) + listOf(-0.45f)
        assetPaths.forEachIndexed { index, path ->
            val slot = slots.getOrElse(index) { 0f }
            val label = path.substringAfterLast("/").removeSuffix(".glb")
            markers.add(PlacedMarker(path, label, slot))
        }
    }

    fun clearNodes() {
        markers.clear()
    }

    fun sessionStable(): Boolean = started

    fun modelsPlaced(): Int = markers.size
}
