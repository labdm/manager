import Foundation

/// Live-query connection state, as surfaced to the UI.
public enum ConnectionStatus: String, Sendable, Equatable, CaseIterable {
  /// The client is trying to reach Convex and has not succeeded yet.
  case connecting
  /// Live queries are flowing.
  case connected
  /// The client lost the connection and is retrying.
  case offline

  public var isConnected: Bool { self == .connected }
}
