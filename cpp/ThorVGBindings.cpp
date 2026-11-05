#include "ThorVGBindings.h"

#include <cmath>
#include <cstdint>
#include <cstring>
#include <exception>
#include <initializer_list>
#include <memory>
#include <mutex>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

#include "ThorVGHandle.h"
#include "ThorVGPlayer.h"
#include "ThorVGSurface.h"

#define THORVG_TTF_LOADER_SUPPORT 1
#include "ThorVGDefaultFont.h"

namespace thorvg::rn {

namespace {

jsi::Runtime* gRuntime = nullptr;
std::exception_ptr gPendingError;

template <typename T>
struct IsHandle : std::false_type {};
template <>
struct IsHandle<Tvg_Paint> : std::true_type {};
template <>
struct IsHandle<Tvg_Gradient> : std::true_type {};
template <>
struct IsHandle<Tvg_Animation> : std::true_type {};
template <>
struct IsHandle<Tvg_Accessor> : std::true_type {};

double number(const jsi::Value& value) {
  if (value.isNumber()) {
    double d = value.getNumber();
    return std::isfinite(d) ? d : 0.0;
  }
  if (value.isBool()) return value.getBool() ? 1.0 : 0.0;
  return 0.0;
}

template <typename T, typename Enable = void>
struct Arg;

template <typename T>
struct Arg<T, std::enable_if_t<std::is_same_v<T, bool>>> {
  static T get(jsi::Runtime&, const jsi::Value& value) { return number(value) != 0.0; }
};

template <typename T>
struct Arg<T, std::enable_if_t<std::is_floating_point_v<T>>> {
  static T get(jsi::Runtime&, const jsi::Value& value) { return static_cast<T>(number(value)); }
};

template <typename T>
struct Arg<T, std::enable_if_t<std::is_integral_v<T> && !std::is_same_v<T, bool>>> {
  static T get(jsi::Runtime&, const jsi::Value& value) {
    return static_cast<T>(static_cast<int64_t>(number(value)));
  }
};

template <typename T>
struct Arg<T, std::enable_if_t<std::is_enum_v<T>>> {
  static T get(jsi::Runtime&, const jsi::Value& value) {
    return static_cast<T>(static_cast<int64_t>(number(value)));
  }
};

template <typename T>
struct Arg<T, std::enable_if_t<IsHandle<T>::value>> {
  static T get(jsi::Runtime& rt, const jsi::Value& value) { return handlePtr<T>(rt, value); }
};

template <typename R>
jsi::Value ret(R value) {
  if constexpr (std::is_same_v<R, bool>) {
    return jsi::Value(value);
  } else if constexpr (std::is_enum_v<R>) {
    return jsi::Value(static_cast<int>(value));
  } else {
    return jsi::Value(static_cast<double>(value));
  }
}

template <typename R, typename... A, size_t... I>
jsi::Value call(R (*fn)(A...), jsi::Runtime& rt, const jsi::Value* args, size_t count, std::index_sequence<I...>) {
  static const jsi::Value undefined;
  auto at = [&](size_t i) -> const jsi::Value& { return i < count ? args[i] : undefined; };
  if constexpr (std::is_void_v<R>) {
    fn(Arg<std::remove_cv_t<A>>::get(rt, at(I))...);
    return jsi::Value::undefined();
  } else {
    return ret<R>(fn(Arg<std::remove_cv_t<A>>::get(rt, at(I))...));
  }
}

const jsi::Value& at(const jsi::Value* args, size_t count, size_t index) {
  static const jsi::Value undefined;
  return index < count ? args[index] : undefined;
}

struct Bytes {
  const uint8_t* data = nullptr;
  size_t size = 0;
};

Bytes bytes(jsi::Runtime& rt, const jsi::Value& value) {
  if (!value.isObject()) return {};
  auto object = value.getObject(rt);
  if (object.isArrayBuffer(rt)) {
    auto buffer = object.getArrayBuffer(rt);
    return {buffer.data(rt), buffer.size(rt)};
  }
  auto offset = static_cast<size_t>(number(object.getProperty(rt, "byteOffset")));
  auto length = static_cast<size_t>(number(object.getProperty(rt, "byteLength")));
  auto source = object.getProperty(rt, "buffer");
  if (!source.isObject() || !source.getObject(rt).isArrayBuffer(rt)) {
    throw jsi::JSError(rt, "ThorVG: expected an ArrayBuffer or a typed array");
  }
  auto buffer = source.getObject(rt).getArrayBuffer(rt);
  if (offset + length > buffer.size(rt)) throw jsi::JSError(rt, "ThorVG: typed array is out of bounds");
  return {buffer.data(rt) + offset, length};
}

std::string text(jsi::Runtime& rt, const jsi::Value& value) {
  return value.isString() ? value.getString(rt).utf8(rt) : std::string();
}

jsi::Value string(jsi::Runtime& rt, const char* value) {
  if (!value) return jsi::Value::null();
  return jsi::String::createFromUtf8(rt, value);
}

jsi::Array floatArray(jsi::Runtime& rt, const float* values, size_t count) {
  jsi::Array array(rt, count);
  for (size_t i = 0; i < count; ++i) array.setValueAtIndex(rt, i, static_cast<double>(values[i]));
  return array;
}

class CanvasState : public jsi::NativeState {
 public:
  explicit CanvasState(std::shared_ptr<CanvasHost> host) : host_(std::move(host)) {}
  ~CanvasState() override {
    if (!host_) return;
    deferRelease([host = std::move(host_)] { SurfaceRegistry::shared().unbindCanvas(host->surfaceId(), host.get()); });
  }

  CanvasHost* host() const { return host_.get(); }
  std::shared_ptr<CanvasHost> shared() const { return host_; }

  void destroy() {
    if (!host_) return;
    SurfaceRegistry::shared().unbindCanvas(host_->surfaceId(), host_.get());
    host_.reset();
  }

 private:
  std::shared_ptr<CanvasHost> host_;
};

class PlayerState : public jsi::NativeState {
 public:
  explicit PlayerState(std::shared_ptr<Player> player) : player_(std::move(player)) {}
  ~PlayerState() override {
    if (!player_) return;
    deferRelease([player = std::move(player_)] { player->destroy(); });
  }

  Player* player() const { return player_.get(); }

  void destroy() {
    if (!player_) return;
    player_->destroy();
    player_.reset();
  }

 private:
  std::shared_ptr<Player> player_;
};

CanvasState* canvasState(jsi::Runtime& rt, const jsi::Value& value) {
  if (!value.isObject()) throw jsi::JSError(rt, "ThorVG: expected a canvas handle");
  auto object = value.getObject(rt);
  if (!object.hasNativeState<CanvasState>(rt)) throw jsi::JSError(rt, "ThorVG: expected a canvas handle");
  return object.getNativeState<CanvasState>(rt).get();
}

CanvasHost* canvasHost(jsi::Runtime& rt, const jsi::Value& value) {
  return canvasState(rt, value)->host();
}

jsi::Value dispatch(jsi::Runtime& rt, double id, std::initializer_list<jsi::Value> extra) {
  auto callback = rt.global().getPropertyAsFunction(rt, "__thorvgCallback");
  std::vector<jsi::Value> args;
  args.reserve(extra.size() + 1);
  args.emplace_back(id);
  for (auto& value : extra) args.emplace_back(rt, value);
  return callback.call(rt, static_cast<const jsi::Value*>(args.data()), args.size());
}

bool assetResolver(Tvg_Paint paint, const char* src, void* data) {
  if (!gRuntime) return false;
  auto& rt = *gRuntime;
  try {
    auto result = dispatch(rt, static_cast<double>(reinterpret_cast<intptr_t>(data)),
                           {makeHandle(rt, paint, Handle::Kind::Paint, false), string(rt, src ? src : "")});
    return result.isBool() && result.getBool();
  } catch (...) {
    return false;
  }
}

bool accessorVisitor(Tvg_Paint paint, void* data) {
  if (!gRuntime) return false;
  auto& rt = *gRuntime;
  try {
    auto result = dispatch(rt, static_cast<double>(reinterpret_cast<intptr_t>(data)),
                           {makeHandle(rt, paint, Handle::Kind::Paint, false)});
    return result.isBool() && result.getBool();
  } catch (...) {
    if (!gPendingError) gPendingError = std::current_exception();
    return false;
  }
}

class OwnedBuffer : public jsi::MutableBuffer {
 public:
  OwnedBuffer(const char* data, size_t size) : data_(data, data + size) {}
  size_t size() const override { return data_.size(); }
  uint8_t* data() override { return data_.data(); }

 private:
  std::vector<uint8_t> data_;
};

jsi::Value uint8Array(jsi::Runtime& rt, const char* data, size_t size) {
  jsi::ArrayBuffer buffer(rt, std::make_shared<OwnedBuffer>(data, size));
  return rt.global().getPropertyAsFunction(rt, "Uint8Array").callAsConstructor(rt, buffer);
}

void audioResolver(const Tvg_Audio_Info* info, void* data) {
  if (!gRuntime || !info) return;
  auto& rt = *gRuntime;
  try {
    jsi::Object out(rt);
    out.setProperty(rt, "active", info->active);
    out.setProperty(rt, "embedded", info->embedded);
    out.setProperty(rt, "offset", static_cast<double>(info->offset));
    out.setProperty(rt, "volume", static_cast<double>(info->volume));
    out.setProperty(rt, "mimeType", string(rt, info->mimeType));
    if (info->embedded) {
      if (info->src && info->size) out.setProperty(rt, "data", uint8Array(rt, info->src, info->size));
    } else {
      out.setProperty(rt, "src", string(rt, info->src));
    }
    dispatch(rt, static_cast<double>(reinterpret_cast<intptr_t>(data)), {jsi::Value(std::move(out))});
  } catch (...) {
    if (!gPendingError) gPendingError = std::current_exception();
  }
}

void rethrowPending() {
  if (auto error = std::exchange(gPendingError, nullptr)) std::rethrow_exception(error);
}

class Builder {
 public:
  Builder(jsi::Runtime& rt, jsi::Object& target) : rt_(rt), target_(target) {}

  void fn(const char* name, unsigned int argc, jsi::HostFunctionType body) {
    target_.setProperty(
        rt_, name,
        jsi::Function::createFromHostFunction(
            rt_, jsi::PropNameID::forAscii(rt_, name), argc,
            [body = std::move(body)](jsi::Runtime& rt, const jsi::Value& self, const jsi::Value* args, size_t count) {
              std::lock_guard<std::recursive_mutex> lock(engineMutex());
              drainReleases();
              return body(rt, self, args, count);
            }));
  }

  template <typename R, typename... A>
  void capi(const char* name, R (*f)(A...)) {
    fn(name, sizeof...(A), [f](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
      return call(f, rt, args, count, std::index_sequence_for<A...>{});
    });
  }

  template <typename R>
  void create(const char* name, R (*f)(), Handle::Kind kind) {
    fn(name, 0, [f, kind](jsi::Runtime& rt, const jsi::Value&, const jsi::Value*, size_t) {
      return makeHandle(rt, f(), kind, true);
    });
  }

 private:
  jsi::Runtime& rt_;
  jsi::Object& target_;
};

#define TVG_BIND(builder, name) builder.capi(#name, name)

using Args = const jsi::Value*;

void installPaint(Builder& b) {
  TVG_BIND(b, tvg_paint_ref);
  TVG_BIND(b, tvg_paint_unref);
  TVG_BIND(b, tvg_paint_set_visible);
  TVG_BIND(b, tvg_paint_get_visible);
  TVG_BIND(b, tvg_paint_get_id);
  TVG_BIND(b, tvg_paint_set_id);
  TVG_BIND(b, tvg_paint_scale);
  TVG_BIND(b, tvg_paint_rotate);
  TVG_BIND(b, tvg_paint_translate);
  TVG_BIND(b, tvg_paint_set_opacity);
  TVG_BIND(b, tvg_paint_intersects_region);
  TVG_BIND(b, tvg_paint_set_mask_method);
  TVG_BIND(b, tvg_paint_set_clip);
  TVG_BIND(b, tvg_paint_set_blend_method);

  b.fn("tvg_paint_duplicate", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    return makeHandle(rt, tvg_paint_duplicate(handlePtr<Tvg_Paint>(rt, at(args, count, 0))), Handle::Kind::Paint,
                      true);
  });

  b.fn("tvg_paint_get_opacity", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    uint8_t opacity = 0;
    tvg_paint_get_opacity(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &opacity);
    return jsi::Value(static_cast<double>(opacity));
  });

  b.fn("tvg_paint_get_type", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    Tvg_Type type = TVG_TYPE_UNDEF;
    tvg_paint_get_type(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &type);
    return jsi::Value(static_cast<int>(type));
  });

  b.fn("tvg_paint_get_aabb", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    float box[4] = {0, 0, 0, 0};
    tvg_paint_get_aabb(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &box[0], &box[1], &box[2], &box[3]);
    return floatArray(rt, box, 4);
  });

  b.fn("tvg_paint_get_obb", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    Tvg_Point points[4];
    if (tvg_paint_get_obb(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), points) != TVG_RESULT_SUCCESS) {
      return jsi::Value::null();
    }
    return floatArray(rt, &points[0].x, 8);
  });

  b.fn("tvg_paint_set_transform", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto matrix = bytes(rt, at(args, count, 1));
    if (matrix.size < sizeof(Tvg_Matrix)) return jsi::Value(static_cast<int>(TVG_RESULT_INVALID_ARGUMENT));
    Tvg_Matrix m;
    std::memcpy(&m, matrix.data, sizeof(Tvg_Matrix));
    return jsi::Value(static_cast<int>(tvg_paint_set_transform(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &m)));
  });
}

void installShape(Builder& b) {
  b.create("tvg_shape_new", tvg_shape_new, Handle::Kind::Paint);
  TVG_BIND(b, tvg_shape_reset);
  TVG_BIND(b, tvg_shape_move_to);
  TVG_BIND(b, tvg_shape_line_to);
  TVG_BIND(b, tvg_shape_cubic_to);
  TVG_BIND(b, tvg_shape_close);
  TVG_BIND(b, tvg_shape_append_rect);
  TVG_BIND(b, tvg_shape_append_circle);
  TVG_BIND(b, tvg_shape_set_stroke_width);
  TVG_BIND(b, tvg_shape_set_stroke_color);
  TVG_BIND(b, tvg_shape_set_stroke_gradient);
  TVG_BIND(b, tvg_shape_set_stroke_cap);
  TVG_BIND(b, tvg_shape_set_stroke_join);
  TVG_BIND(b, tvg_shape_set_stroke_miterlimit);
  TVG_BIND(b, tvg_shape_set_trimpath);
  TVG_BIND(b, tvg_shape_set_fill_color);
  TVG_BIND(b, tvg_shape_set_fill_rule);
  TVG_BIND(b, tvg_shape_set_paint_order);
  TVG_BIND(b, tvg_shape_set_gradient);

  b.fn("tvg_shape_append_path", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto commands = bytes(rt, at(args, count, 1));
    auto points = bytes(rt, at(args, count, 2));
    std::vector<Tvg_Point> pts(points.size / sizeof(Tvg_Point));
    if (!pts.empty()) std::memcpy(pts.data(), points.data, pts.size() * sizeof(Tvg_Point));
    auto result = tvg_shape_append_path(handlePtr<Tvg_Paint>(rt, at(args, count, 0)),
                                        reinterpret_cast<const Tvg_Path_Command*>(commands.data),
                                        static_cast<uint32_t>(commands.size), pts.empty() ? nullptr : pts.data(),
                                        static_cast<uint32_t>(pts.size()));
    return jsi::Value(static_cast<int>(result));
  });

  b.fn("tvg_shape_get_path", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    const Tvg_Path_Command* cmds = nullptr;
    const Tvg_Point* pts = nullptr;
    uint32_t cmdsCnt = 0;
    uint32_t ptsCnt = 0;
    auto result = tvg_shape_get_path(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &cmds, &cmdsCnt, &pts, &ptsCnt);
    jsi::Object out(rt);
    out.setProperty(rt, "result", static_cast<int>(result));
    jsi::Array commands(rt, cmds ? cmdsCnt : 0);
    for (uint32_t i = 0; cmds && i < cmdsCnt; ++i) commands.setValueAtIndex(rt, i, static_cast<int>(cmds[i]));
    out.setProperty(rt, "commands", commands);
    out.setProperty(rt, "points", pts ? floatArray(rt, &pts[0].x, ptsCnt * 2) : jsi::Array(rt, 0));
    return out;
  });

  b.fn("tvg_shape_set_stroke_dash", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto pattern = bytes(rt, at(args, count, 1));
    std::vector<float> dash(pattern.size / sizeof(float));
    if (!dash.empty()) std::memcpy(dash.data(), pattern.data, dash.size() * sizeof(float));
    auto result = tvg_shape_set_stroke_dash(handlePtr<Tvg_Paint>(rt, at(args, count, 0)),
                                            dash.empty() ? nullptr : dash.data(), static_cast<uint32_t>(dash.size()),
                                            static_cast<float>(number(at(args, count, 2))));
    return jsi::Value(static_cast<int>(result));
  });

  b.fn("tvg_shape_get_stroke_dash", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    const float* pattern = nullptr;
    uint32_t cnt = 0;
    float offset = 0;
    auto result = tvg_shape_get_stroke_dash(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &pattern, &cnt, &offset);
    jsi::Object out(rt);
    out.setProperty(rt, "result", static_cast<int>(result));
    out.setProperty(rt, "pattern", pattern ? floatArray(rt, pattern, cnt) : jsi::Array(rt, 0));
    out.setProperty(rt, "offset", static_cast<double>(offset));
    return out;
  });
}

void installGradient(Builder& b) {
  b.create("tvg_linear_gradient_new", tvg_linear_gradient_new, Handle::Kind::Gradient);
  b.create("tvg_radial_gradient_new", tvg_radial_gradient_new, Handle::Kind::Gradient);
  b.create("tvg_conic_gradient_new", tvg_conic_gradient_new, Handle::Kind::Gradient);
  TVG_BIND(b, tvg_linear_gradient_set);
  TVG_BIND(b, tvg_radial_gradient_set);
  TVG_BIND(b, tvg_conic_gradient_set);
  TVG_BIND(b, tvg_gradient_set_spread);
  TVG_BIND(b, tvg_gradient_del);

  b.fn("tvg_gradient_set_color_stops", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto stops = bytes(rt, at(args, count, 1));
    std::vector<Tvg_Color_Stop> list(stops.size / sizeof(Tvg_Color_Stop));
    if (!list.empty()) std::memcpy(list.data(), stops.data, list.size() * sizeof(Tvg_Color_Stop));
    auto result = tvg_gradient_set_color_stops(handlePtr<Tvg_Gradient>(rt, at(args, count, 0)),
                                               list.empty() ? nullptr : list.data(),
                                               static_cast<uint32_t>(list.size()));
    return jsi::Value(static_cast<int>(result));
  });
}

void installPicture(Builder& b) {
  b.create("tvg_picture_new", tvg_picture_new, Handle::Kind::Paint);
  TVG_BIND(b, tvg_picture_set_size);
  TVG_BIND(b, tvg_picture_set_origin);
  TVG_BIND(b, tvg_picture_set_filter);
  TVG_BIND(b, tvg_picture_set_accessible);

  b.fn("tvg_picture_load_data", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto picture = handlePtr<Tvg_Paint>(rt, at(args, count, 0));
    auto mime = text(rt, at(args, count, 2));
    gPendingError = nullptr;
    Tvg_Result result;
    if (at(args, count, 1).isString()) {
      auto source = text(rt, at(args, count, 1));
      result = tvg_picture_load_data(picture, source.data(), static_cast<uint32_t>(source.size()), mime.c_str(), "",
                                     true);
    } else {
      auto data = bytes(rt, at(args, count, 1));
      result = tvg_picture_load_data(picture, reinterpret_cast<const char*>(data.data),
                                     static_cast<uint32_t>(data.size), mime.c_str(), "", true);
    }
    rethrowPending();
    return jsi::Value(static_cast<int>(result));
  });

  b.fn("tvg_picture_load_raw", 5, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto data = bytes(rt, at(args, count, 1));
    auto width = Arg<uint32_t>::get(rt, at(args, count, 2));
    auto height = Arg<uint32_t>::get(rt, at(args, count, 3));
    if (data.size < static_cast<size_t>(width) * height * 4) {
      return jsi::Value(static_cast<int>(TVG_RESULT_INVALID_ARGUMENT));
    }
    std::vector<uint32_t> pixels(static_cast<size_t>(width) * height);
    std::memcpy(pixels.data(), data.data, pixels.size() * 4);
    auto result = tvg_picture_load_raw(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), pixels.data(), width, height,
                                       Arg<Tvg_Colorspace>::get(rt, at(args, count, 4)), true);
    return jsi::Value(static_cast<int>(result));
  });

  b.fn("tvg_picture_get_size", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    float size[2] = {0, 0};
    tvg_picture_get_size(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), &size[0], &size[1]);
    return floatArray(rt, size, 2);
  });

  b.fn("tvg_picture_get_paint", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto paint = tvg_picture_get_paint(handlePtr<Tvg_Paint>(rt, at(args, count, 0)),
                                       Arg<uint32_t>::get(rt, at(args, count, 1)));
    return makeHandle(rt, paint, Handle::Kind::Paint, false);
  });

  b.fn("tvg_picture_set_asset_resolver", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto picture = handlePtr<Tvg_Paint>(rt, at(args, count, 0));
    auto id = static_cast<intptr_t>(number(at(args, count, 1)));
    auto result = id ? tvg_picture_set_asset_resolver(picture, assetResolver, reinterpret_cast<void*>(id))
                     : tvg_picture_set_asset_resolver(picture, nullptr, nullptr);
    return jsi::Value(static_cast<int>(result));
  });
}

void installScene(Builder& b) {
  b.create("tvg_scene_new", tvg_scene_new, Handle::Kind::Paint);
  TVG_BIND(b, tvg_scene_add);
  TVG_BIND(b, tvg_scene_remove);
  TVG_BIND(b, tvg_scene_clear_effects);
  TVG_BIND(b, tvg_scene_add_effect_gaussian_blur);
  TVG_BIND(b, tvg_scene_add_effect_motion_blur);
  TVG_BIND(b, tvg_scene_add_effect_drop_shadow);
  TVG_BIND(b, tvg_scene_add_effect_fill);
  TVG_BIND(b, tvg_scene_add_effect_tint);
  TVG_BIND(b, tvg_scene_add_effect_tritone);
}

void installText(Builder& b) {
  b.create("tvg_text_new", tvg_text_new, Handle::Kind::Paint);
  TVG_BIND(b, tvg_text_set_size);
  TVG_BIND(b, tvg_text_align);
  TVG_BIND(b, tvg_text_layout);
  TVG_BIND(b, tvg_text_wrap_mode);
  TVG_BIND(b, tvg_text_line_count);
  TVG_BIND(b, tvg_text_spacing);
  TVG_BIND(b, tvg_text_set_italic);
  TVG_BIND(b, tvg_text_set_outline);
  TVG_BIND(b, tvg_text_set_color);
  TVG_BIND(b, tvg_text_set_gradient);

  b.fn("tvg_text_set_font", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto name = text(rt, at(args, count, 1));
    return jsi::Value(
        static_cast<int>(tvg_text_set_font(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), name.c_str())));
  });

  b.fn("tvg_text_set_text", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto content = text(rt, at(args, count, 1));
    return jsi::Value(
        static_cast<int>(tvg_text_set_text(handlePtr<Tvg_Paint>(rt, at(args, count, 0)), content.c_str())));
  });

  b.fn("tvg_font_load_data", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto name = text(rt, at(args, count, 0));
    if (!at(args, count, 1).isObject()) {
      return jsi::Value(static_cast<int>(tvg_font_load_data(name.c_str(), nullptr, 0, nullptr, false)));
    }
    auto data = bytes(rt, at(args, count, 1));
    auto mime = text(rt, at(args, count, 2));
    auto result = tvg_font_load_data(name.c_str(), reinterpret_cast<const char*>(data.data),
                                     static_cast<uint32_t>(data.size), mime.c_str(), true);
    return jsi::Value(static_cast<int>(result));
  });
}

void installAnimation(Builder& b) {
  b.create("tvg_animation_new", tvg_animation_new, Handle::Kind::Animation);
  b.create("tvg_lottie_animation_new", tvg_lottie_animation_new, Handle::Kind::Animation);
  TVG_BIND(b, tvg_animation_set_segment);

  b.fn("tvg_animation_set_frame", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    gPendingError = nullptr;
    auto result = tvg_animation_set_frame(handlePtr<Tvg_Animation>(rt, at(args, count, 0)),
                                          static_cast<float>(number(at(args, count, 1))));
    rethrowPending();
    return jsi::Value(static_cast<int>(result));
  });

  b.fn("tvg_lottie_animation_set_audio_resolver", 2,
       [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
         auto animation = handlePtr<Tvg_Animation>(rt, at(args, count, 0));
         auto id = static_cast<intptr_t>(number(at(args, count, 1)));
         gPendingError = nullptr;
         auto result = id ? tvg_lottie_animation_set_audio_resolver(animation, audioResolver,
                                                                    reinterpret_cast<void*>(id))
                          : tvg_lottie_animation_set_audio_resolver(animation, nullptr, nullptr);
         rethrowPending();
         return jsi::Value(static_cast<int>(result));
       });
  TVG_BIND(b, tvg_animation_del);
  TVG_BIND(b, tvg_lottie_animation_apply_slot);
  TVG_BIND(b, tvg_lottie_animation_del_slot);
  TVG_BIND(b, tvg_lottie_animation_set_quality);
  TVG_BIND(b, tvg_lottie_animation_set_volume);
  TVG_BIND(b, tvg_lottie_animation_get_volume);

  b.fn("tvg_animation_get_picture", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto picture = tvg_animation_get_picture(handlePtr<Tvg_Animation>(rt, at(args, count, 0)));
    return makeHandle(rt, picture, Handle::Kind::Paint, false);
  });

  b.fn("tvg_animation_get_total_frame", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    float frames = 0;
    tvg_animation_get_total_frame(handlePtr<Tvg_Animation>(rt, at(args, count, 0)), &frames);
    return jsi::Value(static_cast<double>(frames));
  });

  b.fn("tvg_animation_get_duration", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    float duration = 0;
    tvg_animation_get_duration(handlePtr<Tvg_Animation>(rt, at(args, count, 0)), &duration);
    return jsi::Value(static_cast<double>(duration));
  });

  b.fn("tvg_lottie_animation_gen_slot", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto slot = text(rt, at(args, count, 1));
    auto id = tvg_lottie_animation_gen_slot(handlePtr<Tvg_Animation>(rt, at(args, count, 0)), slot.c_str());
    return jsi::Value(static_cast<double>(id));
  });

  b.fn("tvg_lottie_animation_set_marker", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto animation = handlePtr<Tvg_Animation>(rt, at(args, count, 0));
    if (!at(args, count, 1).isString()) {
      return jsi::Value(static_cast<int>(tvg_lottie_animation_set_marker(animation, nullptr)));
    }
    auto marker = text(rt, at(args, count, 1));
    return jsi::Value(static_cast<int>(tvg_lottie_animation_set_marker(animation, marker.c_str())));
  });

  b.fn("tvg_lottie_animation_get_markers_cnt", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    uint32_t cnt = 0;
    auto result = tvg_lottie_animation_get_markers_cnt(handlePtr<Tvg_Animation>(rt, at(args, count, 0)), &cnt);
    jsi::Object out(rt);
    out.setProperty(rt, "result", static_cast<int>(result));
    out.setProperty(rt, "count", static_cast<double>(cnt));
    return out;
  });

  b.fn("tvg_lottie_animation_get_marker_info", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    const char* name = nullptr;
    float begin = 0;
    float end = 0;
    auto result = tvg_lottie_animation_get_marker_info(handlePtr<Tvg_Animation>(rt, at(args, count, 0)),
                                                       Arg<uint32_t>::get(rt, at(args, count, 1)), &name, &begin,
                                                       &end);
    jsi::Object out(rt);
    out.setProperty(rt, "result", static_cast<int>(result));
    out.setProperty(rt, "name", string(rt, name));
    out.setProperty(rt, "begin", static_cast<double>(begin));
    out.setProperty(rt, "end", static_cast<double>(end));
    return out;
  });
}

void installAccessor(Builder& b) {
  b.create("tvg_accessor_new", tvg_accessor_new, Handle::Kind::Accessor);
  TVG_BIND(b, tvg_accessor_del);

  b.fn("tvg_accessor_generate_id", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto name = text(rt, at(args, count, 0));
    return jsi::Value(static_cast<double>(tvg_accessor_generate_id(name.c_str())));
  });

  b.fn("tvg_accessor_get_name", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    return string(rt, tvg_accessor_get_name(handlePtr<Tvg_Accessor>(rt, at(args, count, 0)),
                                            Arg<uint32_t>::get(rt, at(args, count, 1))));
  });

  b.fn("tvg_accessor_set", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto id = static_cast<intptr_t>(number(at(args, count, 2)));
    gPendingError = nullptr;
    auto result = tvg_accessor_set(handlePtr<Tvg_Accessor>(rt, at(args, count, 0)),
                                   handlePtr<Tvg_Paint>(rt, at(args, count, 1)), accessorVisitor,
                                   reinterpret_cast<void*>(id));
    rethrowPending();
    return jsi::Value(static_cast<int>(result));
  });
}

void installCanvas(Builder& b) {
  b.fn("canvas_create", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    auto surfaceId = Arg<int>::get(rt, at(args, count, 0));
    const auto& name = at(args, count, 2);
    auto renderer = name.isString() ? rendererFromName(name.getString(rt).utf8(rt)) : Renderer::Sw;
    auto host =
        std::make_shared<CanvasHost>(surfaceId, Arg<Tvg_Engine_Option>::get(rt, at(args, count, 1)), renderer);
    if (!host->valid()) return jsi::Value::null();
    SurfaceRegistry::shared().bindCanvas(surfaceId, host);
    jsi::Object object(rt);
    object.setNativeState(rt, std::make_shared<CanvasState>(std::move(host)));
    return object;
  });

  b.fn("canvas_destroy", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    canvasState(rt, at(args, count, 0))->destroy();
    return jsi::Value::undefined();
  });

  b.fn("canvas_renderer", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    return jsi::String::createFromAscii(rt, rendererName(host ? host->renderer() : Renderer::Sw));
  });

  b.fn("canvas_resize", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    if (!host) return jsi::Value(static_cast<int>(TVG_RESULT_INSUFFICIENT_CONDITION));
    return jsi::Value(static_cast<int>(
        host->resize(Arg<uint32_t>::get(rt, at(args, count, 1)), Arg<uint32_t>::get(rt, at(args, count, 2)))));
  });

  b.fn("canvas_render", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    return jsi::Value(static_cast<int>(host ? host->render() : TVG_RESULT_INSUFFICIENT_CONDITION));
  });

  b.fn("tvg_canvas_add", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    auto paint = handlePtr<Tvg_Paint>(rt, at(args, count, 1));
    return jsi::Value(static_cast<int>(host ? host->add(paint) : TVG_RESULT_INSUFFICIENT_CONDITION));
  });

  b.fn("tvg_canvas_remove", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    auto paint = handlePtr<Tvg_Paint>(rt, at(args, count, 1));
    return jsi::Value(static_cast<int>(host ? host->remove(paint) : TVG_RESULT_INSUFFICIENT_CONDITION));
  });

  b.fn("tvg_canvas_update", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    return jsi::Value(static_cast<int>(host ? host->update() : TVG_RESULT_INSUFFICIENT_CONDITION));
  });

  b.fn("tvg_canvas_set_viewport", 5, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto host = canvasHost(rt, at(args, count, 0));
    if (!host) return jsi::Value(static_cast<int>(TVG_RESULT_INSUFFICIENT_CONDITION));
    return jsi::Value(static_cast<int>(
        host->viewport(Arg<int32_t>::get(rt, at(args, count, 1)), Arg<int32_t>::get(rt, at(args, count, 2)),
                       Arg<int32_t>::get(rt, at(args, count, 3)), Arg<int32_t>::get(rt, at(args, count, 4)))));
  });
}

void installHandles(Builder& b) {
  b.fn("disown", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto handle = findHandle(rt, at(args, count, 0))) handle->disown();
    return jsi::Value::undefined();
  });

  b.fn("address", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto handle = findHandle(rt, at(args, count, 0));
    return jsi::Value(handle ? static_cast<double>(reinterpret_cast<uintptr_t>(handle->ptr())) : 0.0);
  });
}

Player* player(jsi::Runtime& rt, const jsi::Value& value) {
  if (!value.isObject()) throw jsi::JSError(rt, "ThorVG: expected a player handle");
  auto object = value.getObject(rt);
  if (!object.hasNativeState<PlayerState>(rt)) throw jsi::JSError(rt, "ThorVG: expected a player handle");
  return object.getNativeState<PlayerState>(rt)->player();
}

void installPlayer(Builder& b) {
  b.fn("player_create", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) -> jsi::Value {
    auto host = canvasState(rt, at(args, count, 0))->shared();
    auto animation = handlePtr<Tvg_Animation>(rt, at(args, count, 1));
    if (!host || !animation) return jsi::Value::null();
    jsi::Object object(rt);
    object.setNativeState(rt, std::make_shared<PlayerState>(std::make_shared<Player>(host, animation)));
    return object;
  });

  b.fn("player_destroy", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    const auto& value = at(args, count, 0);
    if (!value.isObject()) return jsi::Value::undefined();
    auto object = value.getObject(rt);
    if (object.hasNativeState<PlayerState>(rt)) object.getNativeState<PlayerState>(rt)->destroy();
    return jsi::Value::undefined();
  });

  b.fn("player_configure", 6, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto p = player(rt, at(args, count, 0))) {
      p->configure(Arg<float>::get(rt, at(args, count, 1)), Arg<bool>::get(rt, at(args, count, 2)),
                   static_cast<PlayMode>(Arg<int>::get(rt, at(args, count, 3))), Arg<float>::get(rt, at(args, count, 4)),
                   Arg<float>::get(rt, at(args, count, 5)));
    }
    return jsi::Value::undefined();
  });

  b.fn("player_set_listener", 3, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto p = player(rt, at(args, count, 0));
    if (!p) return jsi::Value::undefined();
    auto id = number(at(args, count, 1));
    if (!id) {
      p->setListener(nullptr, false);
      return jsi::Value::undefined();
    }
    p->setListener(
        [id](const char* event, float frame) {
          runOnJS([id, event = std::string(event), frame] {
            if (!gRuntime) return;
            auto& rt = *gRuntime;
            dispatch(rt, id, {jsi::String::createFromUtf8(rt, event), jsi::Value(static_cast<double>(frame))});
          });
        },
        Arg<bool>::get(rt, at(args, count, 2)));
    return jsi::Value::undefined();
  });

  b.fn("player_play", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto p = player(rt, at(args, count, 0))) p->play();
    return jsi::Value::undefined();
  });

  b.fn("player_pause", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto p = player(rt, at(args, count, 0))) p->pause();
    return jsi::Value::undefined();
  });

  b.fn("player_reset", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto p = player(rt, at(args, count, 0))) p->reset();
    return jsi::Value::undefined();
  });

  b.fn("player_seek", 2, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    if (auto p = player(rt, at(args, count, 0))) p->seek(Arg<float>::get(rt, at(args, count, 1)));
    return jsi::Value::undefined();
  });

  b.fn("player_frame", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto p = player(rt, at(args, count, 0));
    return jsi::Value(p ? static_cast<double>(p->frame()) : 0.0);
  });

  b.fn("player_playing", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    auto p = player(rt, at(args, count, 0));
    return jsi::Value(p && p->playing());
  });
}

std::string engineVersion() {
  // TODO: Revert once thorvg 1.1.4 is released.
  return "1.1.3";
}

}

void installEngine(Builder& b) {
  b.fn("engine_init", 1, [](jsi::Runtime& rt, const jsi::Value&, Args args, size_t count) {
    static std::once_flag engine;
    auto threads = Arg<uint32_t>::get(rt, at(args, count, 0));
    std::call_once(engine, [threads] {
      tvg_engine_init(threads);
      tvg_font_load_data("default", requestFont(), DEFAULT_FONT_SIZE, "ttf", false);
    });
    return jsi::Value::undefined();
  });
}

void install(jsi::Runtime& rt, std::shared_ptr<facebook::react::CallInvoker> callInvoker) {
  gRuntime = &rt;
  setScheduler([callInvoker = std::move(callInvoker)](std::function<void()> task) {
    callInvoker->invokeAsync(std::move(task));
  });

  jsi::Object module(rt);
  Builder builder(rt, module);
  installEngine(builder);
  installHandles(builder);
  installCanvas(builder);
  installPaint(builder);
  installShape(builder);
  installGradient(builder);
  installPicture(builder);
  installScene(builder);
  installText(builder);
  installAnimation(builder);
  installPlayer(builder);
  installAccessor(builder);
  module.setProperty(rt, "version", jsi::String::createFromUtf8(rt, engineVersion()));

  rt.global().setProperty(rt, "__thorvg", module);
}

}
