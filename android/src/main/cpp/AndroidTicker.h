#pragma once

#include <functional>

namespace thorvg::rn {

void runOnRenderThread(std::function<void()> task);

}
