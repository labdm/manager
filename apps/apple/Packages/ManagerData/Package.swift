// swift-tools-version: 6.0
import PackageDescription

// ManagerData is the only Swift code that knows about Convex and Clerk.
// It lives in its own package so ManagerKit (models + SwiftUI) stays free of
// heavy dependencies and can be built and tested with the Command Line Tools.
//
// Building this package needs full Xcode: ClerkKit ships a compiled
// `.xcstrings` catalog that requires `xcstringstool`.
let package = Package(
  name: "ManagerData",
  platforms: [
    .iOS(.v17),
    .macOS(.v14),
  ],
  products: [
    .library(name: "ManagerData", targets: ["ManagerData"]),
  ],
  dependencies: [
    .package(path: "../ManagerKit"),
    .package(url: "https://github.com/get-convex/convex-swift", from: "0.8.2"),
    .package(url: "https://github.com/clerk/clerk-ios", from: "1.7.0"),
    .package(url: "https://github.com/clerk/clerk-convex-swift", from: "0.1.0"),
  ],
  targets: [
    .target(
      name: "ManagerData",
      dependencies: [
        .product(name: "ManagerCore", package: "ManagerKit"),
        .product(name: "ConvexMobile", package: "convex-swift"),
        .product(name: "ClerkKit", package: "clerk-ios"),
        .product(name: "ClerkConvex", package: "clerk-convex-swift"),
      ],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
  ]
)
