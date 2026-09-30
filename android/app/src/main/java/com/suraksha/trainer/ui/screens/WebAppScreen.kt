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
import androidx.webkit.WebViewClientCompat

const val WEBAPP_ORIGIN = "https://appassets.androidplatform.net"
const val WEBAPP_ENTRY = "$WEBAPP_ORIGIN/assets/www/index.html"

/**
 * Serves a bundled file from assets/www for our domain, with HTTP range
 * support so video section-seeking behaves exactly like in Chrome.
 */
private fun serveAsset(context: Context, request: WebResourceRequest): WebResourceResponse? {
    var path = request.url?.path?.trimStart('/') ?: return null
    if (path.isEmpty()) path = "index.html"
    var assetPath = "www/$path"
    val ext = assetPath.substringAfterLast('.', "")
    val mime = when (ext) {
        "html" -> "text/html"
        "js" -> "text/javascript"
        "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "ttf" -> "font/ttf"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        else -> "application/octet-stream"
    }
    return try {
        openAssetResponse(context, assetPath, mime, request)
    } catch (notFound: java.io.FileNotFoundException) {
        // SPA fallback: extensionless deep links resolve to index.html
        if (!assetPath.contains('.')) {
            try {
                openAssetResponse(context, "www/index.html", "text/html", request)
            } catch (missing: java.io.FileNotFoundException) {
                null
            }
        } else {
            null
        }
    }
}

private fun openAssetResponse(
    context: Context,
    assetPath: String,
    mime: String,
    request: WebResourceRequest
): WebResourceResponse {
    val afd = context.assets.openFd(assetPath)
    val total = afd.length
    val range = request.requestHeaders["Range"] ?: request.requestHeaders["range"]
    if (range != null) {
        val m = Regex("bytes=(\\d*)-(\\d*)").find(range)
        val start = m?.groupValues?.getOrNull(1)?.toLongOrNull() ?: 0L
        var end = m?.groupValues?.getOrNull(2)?.toLongOrNull() ?: (total - 1)
        if (end >= total) end = total - 1
        if (start < 0 || start >= total) {
            afd.close()
            return WebResourceResponse(
                mime, null, 416, "Range Not Satisfiable",
                mapOf("Content-Range" to "bytes */$total"), null
            )
        }
        val stream = android.content.res.AssetFileDescriptor.AutoCloseInputStream(afd)
        var skipped = 0L
        while (skipped < start) {
            val s = stream.skip(start - skipped)
            if (s <= 0) break
            skipped += s
        }
        val headers = mapOf(
            "Content-Range" to "bytes $start-$end/$total",
            "Accept-Ranges" to "bytes",
            "Content-Length" to "${end - start + 1}"
        )
        return WebResourceResponse(
            mime, null, 206, "Partial Content", headers,
            BoundedInputStream(stream, end - start + 1)
        )
    }
    val headers = mapOf(
        "Accept-Ranges" to "bytes",
        "Content-Length" to "$total"
    )
    return WebResourceResponse(
        mime, null, 200, "OK", headers,
        android.content.res.AssetFileDescriptor.AutoCloseInputStream(afd)
    )
}

private class BoundedInputStream(
    private val wrapped: java.io.InputStream,
    private var remaining: Long
) : java.io.InputStream() {
    override fun read(): Int {
        if (remaining <= 0) return -1
        val b = wrapped.read()
        if (b >= 0) remaining--
        return b
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (remaining <= 0) return -1
        val n = wrapped.read(buffer, offset, minOf(length.toLong(), remaining).toInt())
        if (n > 0) remaining -= n
        return n
    }

    override fun close() {
        runCatching { wrapped.close() }
    }
}

/**
 * Hosts the production web build (dashboard + worker app) inside an offline
 * WebView, so mobile runs EXACTLY the same code as the web version: register,
 * modules, videos, 3D simulations, voice, assessments, QR certificates,
 * export and the admin panel.
 *
 * Served from the bundled assets on https://appassets.androidplatform.net,
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
                webViewClient = object : WebViewClientCompat() {
                    // Serve the bundled web build (assets/www/...) for every
                    // path on our domain, with HTTP range support so <video>
                    // section seeking works exactly like in Chrome.
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        if (request.url?.host != "appassets.androidplatform.net") return null
                        return runCatching { serveAsset(ctx, request) }.getOrNull()
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
