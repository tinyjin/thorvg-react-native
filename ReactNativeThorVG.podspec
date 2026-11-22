require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

resolve_node_package = lambda do |name|
  script = "process.stdout.write(require('path').dirname(require.resolve('#{name}/package.json')))"
  path = `node -e "#{script}" 2>/dev/null`.strip
  path.empty? ? nil : path
end

thorvg_libs = File.join(__dir__, "libs", "ios")
unless File.exist?(File.join(thorvg_libs, "thorvg.xcframework"))
  core = resolve_node_package.call("thorvg-react-native-ios")
  thorvg_libs = File.join(core, "libs") if core
end

unless File.exist?(File.join(thorvg_libs, "thorvg.xcframework"))
  raise "ReactNativeThorVG: thorvg.xcframework not found. Run `yarn build:thorvg ios`."
end

vendored = File.join(__dir__, "libs", "ios")
unless File.expand_path(thorvg_libs) == File.expand_path(vendored)
  FileUtils.rm_rf(vendored)
  FileUtils.mkdir_p(vendored)
  FileUtils.cp_r(File.join(thorvg_libs, "thorvg.xcframework"), vendored)
end

Pod::Spec.new do |s|
  s.name         = "ReactNativeThorVG"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/tinyjin/thorvg-react-native.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}", "cpp/**/*.{h,cpp}"
  s.private_header_files = "ios/**/*.h", "cpp/**/*.h"
  s.vendored_frameworks = "libs/ios/thorvg.xcframework"
  s.frameworks = "IOSurface", "Metal", "QuartzCore"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/cpp\" \"$(PODS_TARGET_SRCROOT)/libs/ios/thorvg.xcframework/ios-arm64/Headers\""
  }

  install_modules_dependencies(s)
end
