#pragma once

#import <QuartzCore/CAMetalLayer.h>

#include <memory>

#include "ThorVGSurface.h"

namespace thorvg::rn {

std::shared_ptr<Surface> makeLayerSurface(CALayer *layer, CAMetalLayer *metalLayer);

}
