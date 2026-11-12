#pragma once

#include <functional>

namespace thorvg::rn {

void setTicker(std::function<void(double)> tick);
void setTickerActive(bool active);
void runOnRenderThread(std::function<void()> task);

}
