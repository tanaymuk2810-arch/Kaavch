package com.suraksha.trainer.ui.screens

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

const val WEBAPP_ORIGIN = "https://appassets.androidplatform.net"
const val WEBAPP_ENTRY = "$WEBAPP_ORIGIN/assets/www/index.html"

/**
 * Hosts the production web build (dashboard + worker app) inside an offline
 * WebView, so mobile runs EXACTLY the same code as the web version: register,
 * modules, videos, 3D simulations, voice, assessments, QR certificates,
 * export and the admin panel.
 *
 * Served through WebViewAssetLoader on https://appassets.androidplatform.net,
 * which is a secure context — so camera (getUserMedia), WebCrypto, speech
 * synthesis and localStorage all work exactly like in Chrome, with zero
 * network. Blob downloads (JSON/CSV exports) are bridged to Downloads.
 */
@Composable
fun WebAppScreen() {
    val context = LocalContext.current
    var hasCamera by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    val cameraGranted by rememberUpdatedState(hasCamera)
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCamera = granted }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (!hasCamera) launcher.launch(Manifest.permission.CAMERA)
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.allowFileAccess = false
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                addJavascriptInterface(BlobSaver(ctx), "AndroidBlob")
                val assetLoader = WebViewAssetLoader.Builder()
                    .setDomain("appassets.androidplatform.net")
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(ctx))
                    .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(ctx))
                    .build()
                webViewClient = object : WebViewClientCompat() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url!!)
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest) {
                        runCatching {
                            if (!cameraGranted) {
                                request.deny()
                                return
                            }
                            request.grant(request.resources)
                        }
                    }
                }
                setDownloadListener { url, _, contentDisposition, mime, _ ->
                    runCatching {
                        if (url.startsWith("blob:")) {
                            val js = "(async()=>{try{const r=await fetch('" + url +
                                "');const b=await r.blob();const fr=new FileReader();" +
                                "fr.onload=()=>AndroidBlob.save(fr.result,'" + mime + "','" +
                                contentDisposition.replace("'", "") + "');" +
                                "fr.readAsDataURL(b);}catch(e){}})()"
                            evaluateJavascript(js, null)
                        } else {
                            Toast.makeText(ctx, "Download started", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                loadUrl(WEBAPP_ENTRY)
            }
        }
    )
}

private class BlobSaver(private val context: Context) {
    @JavascriptInterface
    fun save(dataUrl: String, mime: String, disposition: String) {
        runCatching {
            val base64 = dataUrl.substringAfter(",", "")
            if (base64.isEmpty()) return
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val name = guessName(disposition, mime)
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime.ifBlank { "application/octet-stream" })
                put(
                    MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/Kaavach"
                )
            }
            val resolver = context.contentResolver
            val uri: Uri = resolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            ) ?: return
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                Toast.makeText(context, "Saved to Downloads/Kaavach", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun guessName(disposition: String, mime: String): String {
        val fromHeader = Regex("filename=\"?([^\";]+)\"?")
            .find(disposition)?.groupValues?.getOrNull(1)
        if (!fromHeader.isNullOrBlank()) return fromHeader
        val ext = when {
            mime.contains("json") -> ".json"
            mime.contains("csv") -> ".csv"
            else -> ".bin"
        }
        return "kaavach_export_${System.currentTimeMillis()}$ext"
    }
}
