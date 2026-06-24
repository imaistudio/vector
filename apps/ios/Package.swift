// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "VectorMobile",
  defaultLocalization: "en",
  platforms: [
    .iOS(.v17),
    .macOS(.v14),
  ],
  products: [
    .library(
      name: "VectorMobile",
      targets: ["VectorMobile"]
    ),
  ],
  dependencies: [
    .package(url: "https://github.com/get-convex/convex-swift.git", exact: "0.8.1"),
  ],
  targets: [
    .target(
      name: "VectorMobile",
      dependencies: [
        .product(name: "ConvexMobile", package: "convex-swift"),
      ],
      path: "Sources/VectorMobile"
    ),
    .testTarget(
      name: "VectorMobileTests",
      dependencies: ["VectorMobile"],
      path: "Tests/VectorMobileTests"
    ),
  ]
)

