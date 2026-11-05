package org.thorvg.reactnative

import android.net.Uri
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings
import java.io.FileNotFoundException
import java.io.InputStream

@ReactModule(name = ThorVGModule.NAME)
class ThorVGModule(reactContext: ReactApplicationContext) :
  NativeThorVGSpec(reactContext), TurboModuleWithJSIBindings {

  override fun install(): Boolean = true

  override fun readAsset(uri: String, promise: Promise) {
    try {
      val text = open(uri).use { it.readBytes() }.toString(Charsets.UTF_8)
      promise.resolve(text)
    } catch (e: Exception) {
      promise.reject("E_THORVG_ASSET", "ThorVG: failed to read asset $uri", e)
    }
  }

  private fun open(uri: String): InputStream {
    val context = reactApplicationContext
    val parsed = Uri.parse(uri)
    return when (parsed.scheme) {
      null ->
        if (uri.startsWith("/")) java.io.File(uri).inputStream() else openResource(uri)
      "file" -> {
        val path = parsed.path ?: throw FileNotFoundException(uri)
        if (path.startsWith(ANDROID_ASSET)) {
          context.assets.open(path.removePrefix(ANDROID_ASSET))
        } else {
          java.io.File(path).inputStream()
        }
      }
      "asset" -> context.assets.open(parsed.path.orEmpty().removePrefix("/"))
      else ->
        context.contentResolver.openInputStream(parsed)
          ?: throw FileNotFoundException(uri)
    }
  }

  // Non-images land in res/raw, images in res/drawable
  private fun openResource(name: String): InputStream {
    val context = reactApplicationContext
    val res = context.resources
    val id =
      RESOURCE_TYPES.firstNotNullOfOrNull { type ->
        res.getIdentifier(name, type, context.packageName).takeIf { it != 0 }
      } ?: throw FileNotFoundException("no raw or drawable resource named $name")
    return res.openRawResource(id)
  }

  @DoNotStrip external override fun getBindingsInstaller(): BindingsInstallerHolder

  companion object {
    const val NAME = NativeThorVGSpec.NAME

    private const val ANDROID_ASSET = "/android_asset/"
    private val RESOURCE_TYPES = arrayOf("raw", "drawable")

    init {
      ThorVGNative.load()
    }
  }
}
