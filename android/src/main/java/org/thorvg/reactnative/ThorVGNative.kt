package org.thorvg.reactnative

import android.view.Surface
import com.facebook.proguard.annotations.DoNotStrip

internal object ThorVGNative {
  @Volatile private var loaded = false

  @Synchronized
  fun load() {
    if (loaded) return
    System.loadLibrary("reactnativethorvg")
    loaded = true
  }
}

@DoNotStrip
internal object ThorVGSurfaces {
  init {
    ThorVGNative.load()
  }

  fun attach(surfaceId: Int, surface: Surface): Long = nativeAttach(surfaceId, surface)

  fun detach(surfaceId: Int, handle: Long) = nativeDetach(surfaceId, handle)

  fun setVisible(surfaceId: Int, visible: Boolean) = nativeSetVisible(surfaceId, visible)

  fun presentedLayout(handle: Long): Long = nativePresentedLayout(handle)

  @JvmStatic @DoNotStrip private external fun nativeAttach(surfaceId: Int, surface: Surface): Long

  @JvmStatic @DoNotStrip private external fun nativeDetach(surfaceId: Int, handle: Long)

  @JvmStatic @DoNotStrip private external fun nativeSetVisible(surfaceId: Int, visible: Boolean)

  @JvmStatic @DoNotStrip private external fun nativePresentedLayout(handle: Long): Long
}
