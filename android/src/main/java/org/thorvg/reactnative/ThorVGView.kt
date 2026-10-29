package org.thorvg.reactnative

import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.SurfaceTexture
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import com.facebook.react.views.view.ReactViewGroup

class ThorVGView(context: Context) : ReactViewGroup(context) {
  private var surfaceId = 0
  private var backingView = BackingView.TEXTURE_VIEW
  private var renderView: View? = null
  private var surface: Surface? = null
  private var ownsSurface = false
  private var attached = false
  private var visible = true
  private val visibleRect = Rect()
  private val clipRect = Rect()
  private val location = IntArray(2)
  private val drawListener = ViewTreeObserver.OnPreDrawListener {
    updateVisibility()
    true
  }

  init {
    rebuild()
  }

  fun setSurfaceId(value: Int) {
    if (value == surfaceId) return
    detachSurface()
    surfaceId = value
    attachSurface()
    visible = computeVisibility()
    reportVisibility()
  }

  fun setBackingView(value: String?) {
    val kind = if (value == "SurfaceView") BackingView.SURFACE_VIEW else BackingView.TEXTURE_VIEW
    if (kind == backingView) return
    backingView = kind
    rebuild()
  }

  fun release() {
    detachSurface()
    releaseSurface()
    surfaceId = 0
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(drawListener)
    updateVisibility()
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(drawListener)
    super.onDetachedFromWindow()
    updateVisibility()
  }

  override fun onVisibilityAggregated(isVisible: Boolean) {
    super.onVisibilityAggregated(isVisible)
    updateVisibility()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val width = right - left
    val height = bottom - top
    renderView?.let {
      it.measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      )
      it.layout(0, 0, width, height)
    }
  }

  private fun updateVisibility() {
    val value = computeVisibility()
    if (value == visible) return
    visible = value
    reportVisibility()
  }

  private fun computeVisibility() = isShown && windowVisibility == VISIBLE && isOnScreen()

  private fun isOnScreen(): Boolean {
    if (width == 0 || height == 0) return false
    windowRect(this, visibleRect)
    var parent = parent
    while (parent is ViewGroup) {
      if (parent is ScrollView || parent is HorizontalScrollView || parent.clipChildren) {
        windowRect(parent, clipRect)
        if (!visibleRect.intersect(clipRect)) return false
      }
      parent = parent.parent
    }
    return true
  }

  private fun windowRect(view: View, rect: Rect) {
    view.getLocationInWindow(location)
    rect.set(location[0], location[1], location[0] + view.width, location[1] + view.height)
  }

  private fun reportVisibility() {
    if (surfaceId != 0) ThorVGSurfaces.setVisible(surfaceId, visible)
  }

  private fun rebuild() {
    detachSurface()
    releaseSurface()
    renderView?.let { removeView(it) }
    renderView = when (backingView) {
      BackingView.TEXTURE_VIEW -> createTextureView()
      BackingView.SURFACE_VIEW -> createSurfaceView()
    }.also { addView(it) }
    requestLayout()
  }

  private fun createTextureView(): TextureView =
    TextureView(context).apply {
      isOpaque = false
      surfaceTextureListener = object : TextureView.SurfaceTextureListener {
        override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
          setSurface(Surface(texture), owned = true)
        }

        override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) = Unit

        override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean {
          detachSurface()
          releaseSurface()
          return true
        }

        override fun onSurfaceTextureUpdated(texture: SurfaceTexture) = Unit
      }
    }

  private fun createSurfaceView(): SurfaceView =
    SurfaceView(context).apply {
      holder.setFormat(PixelFormat.TRANSLUCENT)
      holder.addCallback(object : SurfaceHolder.Callback {
        override fun surfaceCreated(holder: SurfaceHolder) {
          setSurface(holder.surface, owned = false)
        }

        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) = Unit

        override fun surfaceDestroyed(holder: SurfaceHolder) {
          detachSurface()
          releaseSurface()
        }
      })
    }

  private fun setSurface(value: Surface, owned: Boolean) {
    detachSurface()
    releaseSurface()
    surface = value
    ownsSurface = owned
    attachSurface()
  }

  private fun attachSurface() {
    val current = surface ?: return
    if (surfaceId == 0 || attached || !current.isValid) return
    ThorVGSurfaces.attach(surfaceId, current)
    attached = true
  }

  private fun detachSurface() {
    if (!attached) return
    ThorVGSurfaces.detach(surfaceId)
    attached = false
  }

  private fun releaseSurface() {
    if (ownsSurface) surface?.release()
    surface = null
    ownsSurface = false
  }

  private enum class BackingView { TEXTURE_VIEW, SURFACE_VIEW }
}
