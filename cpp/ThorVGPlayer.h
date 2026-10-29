#pragma once

#include <functional>
#include <memory>

#include "ThorVGSurface.h"

namespace thorvg::rn {

void wakePlayers();

enum class PlayMode { Forward, Reverse, Bounce, ReverseBounce };

// Callers hold engineMutex().
class Player : public std::enable_shared_from_this<Player> {
 public:
  using Listener = std::function<void(const char* event, float frame)>;

  Player(std::shared_ptr<CanvasHost> host, Tvg_Animation animation);

  void configure(float speed, bool loop, PlayMode mode, float start, float end);
  void setListener(Listener listener, bool frames);
  void play();
  void pause();
  void reset();
  void seek(float frame);
  float frame() const { return frame_; }
  bool playing() const { return playing_; }
  bool visible() const;
  void destroy();

  void tick(double now);

 private:
  void draw();
  void range(float& start, float& end) const;
  void emit(const char* event);

  std::weak_ptr<CanvasHost> host_;
  Tvg_Animation animation_;
  float speed_ = 1;
  bool loop_ = false;
  PlayMode mode_ = PlayMode::Forward;
  float start_ = 0;
  float end_ = -1;
  float frame_ = 0;
  int direction_ = 1;
  bool playing_ = false;
  double last_ = 0;
  Listener listener_;
  bool frames_ = false;
};

}
