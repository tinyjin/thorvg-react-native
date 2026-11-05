#include "ThorVGPlayer.h"

#include <algorithm>
#include <atomic>
#include <mutex>
#include <vector>

#include "ThorVGTicker.h"

namespace thorvg::rn {

namespace {

std::vector<std::shared_ptr<Player>>& active() {
  static std::vector<std::shared_ptr<Player>> players;
  return players;
}

std::atomic<bool> installed{false};
std::atomic<uint64_t> wakeups{0};

std::mutex& tickerMutex() {
  static std::mutex mutex;
  return mutex;
}

void tickAll(double now) {
  std::lock_guard<EngineMutex> lock(engineMutex());
  auto epoch = wakeups.load();
  auto players = active();
  auto running = false;
  for (auto& player : players) {
    running = running || player->visible();
    player->tick(now);
  }
  if (running) return;
  std::lock_guard<std::mutex> ticker(tickerMutex());
  if (wakeups == epoch) setTickerActive(false);
}

void activate(const std::shared_ptr<Player>& player) {
  if (!installed) {
    setTicker(tickAll);
    installed = true;
  }
  auto& players = active();
  if (std::find(players.begin(), players.end(), player) == players.end()) players.push_back(player);
  setTickerActive(true);
}

void deactivate(const Player* player) {
  auto& players = active();
  players.erase(std::remove_if(players.begin(), players.end(), [player](auto& p) { return p.get() == player; }),
                players.end());
  if (players.empty()) setTickerActive(false);
}

}

void wakePlayers() {
  if (!installed) return;
  std::lock_guard<std::mutex> lock(tickerMutex());
  ++wakeups;
  setTickerActive(true);
}

Player::Player(std::shared_ptr<CanvasHost> host, Tvg_Animation animation) : host_(host), animation_(animation) {}

void Player::configure(float speed, bool loop, PlayMode mode, float start, float end) {
  speed_ = speed;
  loop_ = loop;
  mode_ = mode;
  start_ = start;
  end_ = end;
}

void Player::setListener(Listener listener, bool frames) {
  listener_ = std::move(listener);
  frames_ = frames;
}

void Player::play() {
  if (playing_ || !animation_) return;
  playing_ = true;
  last_ = 0;
  activate(shared_from_this());
}

void Player::pause() {
  playing_ = false;
  deactivate(this);
}

void Player::reset() {
  float start, end;
  range(start, end);
  auto reverse = mode_ == PlayMode::Reverse || mode_ == PlayMode::ReverseBounce;
  direction_ = reverse ? -1 : 1;
  frame_ = reverse ? end : start;
  draw();
}

void Player::seek(float frame) {
  frame_ = frame;
  draw();
}

void Player::destroy() {
  pause();
  host_.reset();
  animation_ = nullptr;
  listener_ = nullptr;
}

bool Player::visible() const {
  auto host = host_.lock();
  return !host || host->visible();
}

void Player::tick(double now) {
  if (!playing_ || !animation_) return;
  if (!visible()) {
    last_ = 0;
    return;
  }
  float total = 0, duration = 0;
  tvg_animation_get_total_frame(animation_, &total);
  tvg_animation_get_duration(animation_, &duration);
  float fps = duration > 0 ? total / duration : 0;
  float start, end;
  range(start, end);

  auto elapsed = last_ > 0 ? now - last_ : 0.0;
  last_ = now;

  auto frame = static_cast<float>(frame_ + elapsed * fps * speed_ * direction_);
  auto bounce = mode_ == PlayMode::Bounce || mode_ == PlayMode::ReverseBounce;
  if (frame > end || frame < start) {
    auto finished = bounce ? (mode_ == PlayMode::Bounce) == (direction_ == -1) : true;
    if (bounce && (!finished || loop_)) {
      direction_ = -direction_;
      frame = frame > end ? end : start;
      if (finished) emit("loop");
    } else if (loop_) {
      frame = direction_ == 1 ? start : end;
      emit("loop");
    } else {
      frame_ = frame > end ? end : start;
      pause();
      draw();
      emit("complete");
      return;
    }
  }
  frame_ = frame;
  draw();
}

void Player::draw() {
  auto host = host_.lock();
  if (!host || !animation_) return;
  tvg_animation_set_frame(animation_, frame_);
  if (host->renderer() == Renderer::Gl) {
    host->render();
  } else {
    host->update();
    host->renderNow();
  }
  if (frames_) emit("frame");
}

void Player::range(float& start, float& end) const {
  float total = 0;
  if (animation_) tvg_animation_get_total_frame(animation_, &total);
  auto last = std::max(0.0f, total - 1);
  start = start_;
  end = end_ < 0 ? last : end_;
}

void Player::emit(const char* event) {
  if (listener_) listener_(event, frame_);
}

}
