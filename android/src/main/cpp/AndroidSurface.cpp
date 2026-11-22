#include "AndroidSurface.h"

#include <algorithm>
#include <cstring>
#include <vector>

#include "ThorVGTicker.h"

#if THORVG_RN_VULKAN
#include <android/log.h>
#include <dlfcn.h>
#include <vulkan/vulkan.h>
#include <vulkan/vulkan_android.h>
#endif

namespace thorvg::rn {

namespace {

class GlGpu final : public Gpu {
 public:
  static GlGpu* shared() {
    static GlGpu* gpu = [] {
      auto* instance = new GlGpu();
      if (instance->init()) return instance;
      delete instance;
      return static_cast<GlGpu*>(nullptr);
    }();
    return gpu;
  }

  Renderer renderer() const override { return Renderer::Gl; }

  Tvg_Canvas create(Tvg_Engine_Option option) override { return tvg_glcanvas_create(option); }

  void bind(Surface* surface) override {
    auto* android = static_cast<AndroidSurface*>(surface);
    auto draw = android && android->egl() != EGL_NO_SURFACE ? android->egl() : pbuffer_;
    if (eglGetCurrentContext() == context_ && eglGetCurrentSurface(EGL_DRAW) == draw) return;
    eglMakeCurrent(display_, draw, draw, context_);
  }

  void unbind() override { eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT); }

  void schedule(std::function<void()> task) override {
    {
      std::lock_guard<std::mutex> lock(tasksMutex_);
      tasks_.push_back(std::move(task));
      if (tasks_.size() > 1) return;
    }
    runOnRenderThread([this] { flush(); });
  }

  void release(Tvg_Canvas canvas, std::shared_ptr<Surface> surface) override {
    schedule([this, canvas, surface = std::move(surface)] { Gpu::release(canvas, surface); });
  }

  EGLSurface createSurface(ANativeWindow* window) {
    auto surface = eglCreateWindowSurface(display_, config_, window, nullptr);
    if (surface == EGL_NO_SURFACE) return surface;
    eglMakeCurrent(display_, surface, surface, context_);
    eglSwapInterval(display_, 0);
    return surface;
  }

  void destroySurface(EGLSurface surface) { eglDestroySurface(display_, surface); }

  void swap(EGLSurface surface) { eglSwapBuffers(display_, surface); }

  EGLDisplay display() const { return display_; }
  EGLContext context() const { return context_; }

 private:
  bool init() {
    display_ = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (display_ == EGL_NO_DISPLAY || !eglInitialize(display_, nullptr, nullptr)) return false;

    const EGLint configAttribs[] = {
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT | EGL_PBUFFER_BIT,
        EGL_RED_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_BLUE_SIZE, 8,
        EGL_ALPHA_SIZE, 8,
        EGL_NONE,
    };
    EGLint count = 0;
    if (!eglChooseConfig(display_, configAttribs, &config_, 1, &count) || count == 0) return false;

    const EGLint contextAttribs[] = {EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE};
    context_ = eglCreateContext(display_, config_, EGL_NO_CONTEXT, contextAttribs);
    if (context_ == EGL_NO_CONTEXT) return false;

    const EGLint pbufferAttribs[] = {EGL_WIDTH, 1, EGL_HEIGHT, 1, EGL_NONE};
    pbuffer_ = eglCreatePbufferSurface(display_, config_, pbufferAttribs);
    if (pbuffer_ == EGL_NO_SURFACE) {
      eglDestroyContext(display_, context_);
      return false;
    }
    return true;
  }

  // The context is only current while the engine lock is held, so JS calls can run between tasks.
  void flush() {
    std::vector<std::function<void()>> tasks;
    {
      std::lock_guard<std::mutex> lock(tasksMutex_);
      tasks.swap(tasks_);
    }
    for (auto& task : tasks) {
      std::lock_guard<EngineMutex> engine(engineMutex());
      task();
      unbind();
    }
  }

  std::mutex tasksMutex_;
  std::vector<std::function<void()>> tasks_;
  EGLDisplay display_ = EGL_NO_DISPLAY;
  EGLConfig config_ = nullptr;
  EGLContext context_ = EGL_NO_CONTEXT;
  EGLSurface pbuffer_ = EGL_NO_SURFACE;
};

#if THORVG_RN_VULKAN
class VkGpu final : public Gpu {
 public:
  static VkGpu* shared() {
    static VkGpu* gpu = [] {
      auto* instance = new VkGpu();
      if (instance->init()) return instance;
      delete instance;
      __android_log_print(ANDROID_LOG_WARN, "ThorVG", "Vulkan is unavailable, falling back to sw.");
      return static_cast<VkGpu*>(nullptr);
    }();
    return gpu;
  }

  ~VkGpu() override {
    if (device_) destroyDevice_(device_, nullptr);
    if (instance_) destroyInstance_(instance_, nullptr);
    if (library_) dlclose(library_);
  }

  Renderer renderer() const override { return Renderer::Vk; }

  Tvg_Canvas create(Tvg_Engine_Option option) override { return tvg_vkcanvas_create(option); }

  void bind(Surface*) override {}

  Tvg_Result target(Surface* surface, Tvg_Canvas canvas, uint32_t width, uint32_t height) override {
    return static_cast<AndroidSurface*>(surface)->targetVulkan(canvas, width, height);
  }

  uint64_t createSurface(ANativeWindow* window) {
    VkAndroidSurfaceCreateInfoKHR info{VK_STRUCTURE_TYPE_ANDROID_SURFACE_CREATE_INFO_KHR};
    info.window = window;
    VkSurfaceKHR surface = VK_NULL_HANDLE;
    if (createAndroidSurface_(instance_, &info, nullptr, &surface) != VK_SUCCESS) return 0;
    return reinterpret_cast<uint64_t>(surface);
  }

  void destroySurface(uint64_t surface) {
    destroySurface_(instance_, reinterpret_cast<VkSurfaceKHR>(surface), nullptr);
  }

  const Tvg_VkContext* context() const { return &context_; }

 private:
  template <typename T>
  T instanceProc(const char* name) {
    return reinterpret_cast<T>(getInstanceProcAddr_(instance_, name));
  }

  static bool hasExtension(const std::vector<VkExtensionProperties>& extensions, const char* name) {
    return std::any_of(extensions.begin(), extensions.end(),
                       [name](const VkExtensionProperties& p) { return std::strcmp(p.extensionName, name) == 0; });
  }

  bool init() {
    auto* probe = tvg_vkcanvas_create(TVG_ENGINE_OPTION_DEFAULT);
    if (!probe) return false;
    tvg_canvas_destroy(probe);

    library_ = dlopen("libvulkan.so", RTLD_NOW | RTLD_LOCAL);
    if (!library_) return false;
    getInstanceProcAddr_ = reinterpret_cast<PFN_vkGetInstanceProcAddr>(dlsym(library_, "vkGetInstanceProcAddr"));
    if (!getInstanceProcAddr_) return false;

    auto enumerateInstanceExtensions =
        instanceProc<PFN_vkEnumerateInstanceExtensionProperties>("vkEnumerateInstanceExtensionProperties");
    auto createInstance = instanceProc<PFN_vkCreateInstance>("vkCreateInstance");
    if (!enumerateInstanceExtensions || !createInstance) return false;

    uint32_t count = 0;
    enumerateInstanceExtensions(nullptr, &count, nullptr);
    std::vector<VkExtensionProperties> extensions(count);
    enumerateInstanceExtensions(nullptr, &count, extensions.data());
    if (!hasExtension(extensions, VK_KHR_SURFACE_EXTENSION_NAME) ||
        !hasExtension(extensions, VK_KHR_ANDROID_SURFACE_EXTENSION_NAME)) {
      return false;
    }

    VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};
    app.pEngineName = "ThorVG";
    app.apiVersion = VK_API_VERSION_1_0;
    const char* instanceExtensions[] = {VK_KHR_SURFACE_EXTENSION_NAME, VK_KHR_ANDROID_SURFACE_EXTENSION_NAME};
    VkInstanceCreateInfo instanceInfo{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
    instanceInfo.pApplicationInfo = &app;
    instanceInfo.enabledExtensionCount = 2;
    instanceInfo.ppEnabledExtensionNames = instanceExtensions;
    if (createInstance(&instanceInfo, nullptr, &instance_) != VK_SUCCESS) {
      instance_ = VK_NULL_HANDLE;
      return false;
    }

    destroyInstance_ = instanceProc<PFN_vkDestroyInstance>("vkDestroyInstance");
    destroyDevice_ = instanceProc<PFN_vkDestroyDevice>("vkDestroyDevice");
    createAndroidSurface_ = instanceProc<PFN_vkCreateAndroidSurfaceKHR>("vkCreateAndroidSurfaceKHR");
    destroySurface_ = instanceProc<PFN_vkDestroySurfaceKHR>("vkDestroySurfaceKHR");
    auto enumerateDevices = instanceProc<PFN_vkEnumeratePhysicalDevices>("vkEnumeratePhysicalDevices");
    auto queueFamilies =
        instanceProc<PFN_vkGetPhysicalDeviceQueueFamilyProperties>("vkGetPhysicalDeviceQueueFamilyProperties");
    auto enumerateDeviceExtensions =
        instanceProc<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");
    auto createDevice = instanceProc<PFN_vkCreateDevice>("vkCreateDevice");
    auto getDeviceQueue = instanceProc<PFN_vkGetDeviceQueue>("vkGetDeviceQueue");
    if (!destroyInstance_ || !destroyDevice_ || !createAndroidSurface_ || !destroySurface_ || !enumerateDevices ||
        !queueFamilies || !enumerateDeviceExtensions || !createDevice || !getDeviceQueue) {
      return false;
    }

    enumerateDevices(instance_, &count, nullptr);
    std::vector<VkPhysicalDevice> devices(count);
    enumerateDevices(instance_, &count, devices.data());

    VkPhysicalDevice physical = VK_NULL_HANDLE;
    uint32_t family = 0;
    for (auto candidate : devices) {
      enumerateDeviceExtensions(candidate, nullptr, &count, nullptr);
      std::vector<VkExtensionProperties> deviceExtensions(count);
      enumerateDeviceExtensions(candidate, nullptr, &count, deviceExtensions.data());
      if (!hasExtension(deviceExtensions, VK_KHR_SWAPCHAIN_EXTENSION_NAME)) continue;

      queueFamilies(candidate, &count, nullptr);
      std::vector<VkQueueFamilyProperties> families(count);
      queueFamilies(candidate, &count, families.data());
      for (uint32_t i = 0; i < count; ++i) {
        constexpr VkQueueFlags required = VK_QUEUE_GRAPHICS_BIT | VK_QUEUE_COMPUTE_BIT;
        if ((families[i].queueFlags & required) == required && families[i].queueCount > 0) {
          physical = candidate;
          family = i;
          break;
        }
      }
      if (physical) break;
    }
    if (!physical) return false;

    float priority = 1.0f;
    VkDeviceQueueCreateInfo queueInfo{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
    queueInfo.queueFamilyIndex = family;
    queueInfo.queueCount = 1;
    queueInfo.pQueuePriorities = &priority;
    const char* deviceExtensions[] = {VK_KHR_SWAPCHAIN_EXTENSION_NAME};
    VkDeviceCreateInfo deviceInfo{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
    deviceInfo.queueCreateInfoCount = 1;
    deviceInfo.pQueueCreateInfos = &queueInfo;
    deviceInfo.enabledExtensionCount = 1;
    deviceInfo.ppEnabledExtensionNames = deviceExtensions;
    if (createDevice(physical, &deviceInfo, nullptr, &device_) != VK_SUCCESS) {
      device_ = VK_NULL_HANDLE;
      return false;
    }

    VkQueue queue = VK_NULL_HANDLE;
    getDeviceQueue(device_, family, 0, &queue);
    if (!queue) return false;

    context_.instance = instance_;
    context_.physical_device = physical;
    context_.device = device_;
    context_.queue = queue;
    context_.queue_family_index = family;
    context_.get_instance_proc_addr = reinterpret_cast<void*>(getInstanceProcAddr_);
    return true;
  }

  void* library_ = nullptr;
  PFN_vkGetInstanceProcAddr getInstanceProcAddr_ = nullptr;
  PFN_vkDestroyInstance destroyInstance_ = nullptr;
  PFN_vkDestroyDevice destroyDevice_ = nullptr;
  PFN_vkCreateAndroidSurfaceKHR createAndroidSurface_ = nullptr;
  PFN_vkDestroySurfaceKHR destroySurface_ = nullptr;
  VkInstance instance_ = VK_NULL_HANDLE;
  VkDevice device_ = VK_NULL_HANDLE;
  Tvg_VkContext context_{};
};
#endif

}

Gpu* platformGpu(Renderer renderer) {
#if THORVG_RN_VULKAN
  if (renderer == Renderer::Vk) return VkGpu::shared();
#endif
  return renderer == Renderer::Gl ? GlGpu::shared() : nullptr;
}

void flushPresented() {}

AndroidSurface::~AndroidSurface() {
  if (egl_ != EGL_NO_SURFACE) GlGpu::shared()->destroySurface(egl_);
#if THORVG_RN_VULKAN
  if (vulkan_) VkGpu::shared()->destroySurface(vulkan_);
#endif
  ANativeWindow_release(window_);
}

void AndroidSurface::geometry(uint32_t width, uint32_t height) {
  if (width == width_ && height == height_) return;
  ANativeWindow_setBuffersGeometry(window_, static_cast<int32_t>(width), static_cast<int32_t>(height),
                                   WINDOW_FORMAT_RGBA_8888);
  width_ = width;
  height_ = height;
}

void AndroidSurface::present(const uint32_t* pixels, const Frame& frame) {
  auto width = frame.width;
  auto height = frame.height;
  geometry(width, height);

  // The view releases the window right after detaching, so a retired surface starts no new frame.
  if (!live()) return;

  ANativeWindow_Buffer buffer;
  if (ANativeWindow_lock(window_, &buffer, nullptr) != 0) return;

  auto rows = std::min<uint32_t>(height, static_cast<uint32_t>(buffer.height));
  auto columns = std::min<uint32_t>(width, static_cast<uint32_t>(buffer.width));
  auto* dst = static_cast<uint8_t*>(buffer.bits);
  for (uint32_t y = 0; y < rows; ++y) {
    std::memcpy(dst + static_cast<size_t>(y) * buffer.stride * 4, pixels + static_cast<size_t>(y) * width,
                columns * 4);
  }
  ANativeWindow_unlockAndPost(window_);
}

Tvg_Result AndroidSurface::target(Tvg_Canvas canvas, uint32_t width, uint32_t height) {
  auto* gpu = GlGpu::shared();
  if (!gpu) return TVG_RESULT_NOT_SUPPORTED;

  geometry(width, height);
  if (egl_ == EGL_NO_SURFACE) {
    egl_ = gpu->createSurface(window_);
    if (egl_ == EGL_NO_SURFACE) return TVG_RESULT_INSUFFICIENT_CONDITION;
  }
  gpu->bind(this);
  return tvg_glcanvas_set_target(canvas, gpu->display(), egl_, gpu->context(), 0, width, height,
                                 TVG_COLORSPACE_ABGR8888S);
}

Tvg_Result AndroidSurface::targetVulkan(Tvg_Canvas canvas, uint32_t width, uint32_t height) {
#if THORVG_RN_VULKAN
  auto* gpu = VkGpu::shared();
  if (!gpu) return TVG_RESULT_NOT_SUPPORTED;
  if (!vulkan_) {
    vulkan_ = gpu->createSurface(window_);
    if (!vulkan_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  }
  return tvg_vkcanvas_set_target(canvas, gpu->context(), vulkan_, width, height, TVG_COLORSPACE_ABGR8888, 0);
#else
  return TVG_RESULT_NOT_SUPPORTED;
#endif
}

void AndroidSurface::swap(const Frame&) {
  if (vulkan_) return;
  if (egl_ == EGL_NO_SURFACE || !live()) return;
  GlGpu::shared()->swap(egl_);
}

}
