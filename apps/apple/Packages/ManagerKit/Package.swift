// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "ManagerKit",
  platforms: [
    .iOS(.v17),
    .macOS(.v14),
  ],
  products: [
    .library(name: "ManagerCore", targets: ["ManagerCore"]),
    .library(name: "ManagerUI", targets: ["ManagerUI"]),
  ],
  targets: [
    .target(
      name: "ManagerCore",
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
    .target(
      name: "ManagerUI",
      dependencies: ["ManagerCore"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
    .testTarget(
      name: "ManagerCoreTests",
      dependencies: ["ManagerCore"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
    .testTarget(
      name: "ManagerUITests",
      dependencies: ["ManagerUI"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
  ]
)
