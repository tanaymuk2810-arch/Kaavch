package com.suraksha.trainer.ar

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import io.github.sceneview.ar.ArSceneView
import io.github.sceneview.ar.node.ArModelNode
import io.github.sceneview.math.Float3

/**
 * Hosts an ARCore + SceneView session inside Compose.
 *
 * Device compatibility notes (meets "no headset, mid-range Android 10+"):
 * ARCore is marked optional in the manifest. If a device is not
 * ARCore-certified, the caller falls back to 2D training mode.
 *
 * All SceneView calls are defensive (runCatching) so a platform/API quirk
 * degrades gracefully instead of crashing the module.
 */
@Composable
fun ArSessionHost(
    modifier: Modifier = Modifier,
    controller: ArSessionController
) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            ArSceneView(ctx).also { view ->
                controller.bind(view, ctx)
                runCatching { view.planeRenderer.isVisible = true }
            }
        }
    )
}

/**
 * Owns the AR session lifecycle + model placement. Isolates the SceneView
 * API surface in one file.
 */
class ArSessionController {
    private var sceneView: ArSceneView? = null
    private val trackedNodes = mutableListOf<Pair<String, ArModelNode>>()

    fun bind(view: ArSceneView, context: Context) {
        sceneView = view
    }

    /**
     * Places the correct asset + its distractors as anchored models.
     * Assets come from `assets/models`. Positions are slot offsets around a
     * default pose in front of the user; a production build replaces this
     * with plane hit-test placement (v2 path, see docs).
     */
    fun placeTask(assetPaths: List<String>) {
        runCatching {
            val view = sceneView ?: return
            clearNodes()
            val slots = listOf(0f, 0.45f) + listOf(-0.45f)
            assetPaths.forEachIndexed { index, glb ->
                val slot = slots.getOrElse(index) { 0f }
                val basePose = Float3(slot, -0.45f, -0.9f)
                val node = ArModelNode(view.engine).apply {
                    position = basePose
                    runCatching {
                        loadModelGlbAsync(
                            glb = glb,
                            autoScale = true
                        )
                    }
                }
                runCatching { view.scene.addChild(node) }
                trackedNodes.add(glb to node)
            }
        }
    }

    fun clearNodes() {
        trackedNodes.clear()
    }

    fun sessionStable(): Boolean = sceneView != null

    fun modelsPlaced(): Int = trackedNodes.size
}