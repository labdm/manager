import Foundation

/// One choice in the searchable icon grid. `id` is the Lucide name stored on
/// the record; `symbol` is the SF Symbol drawn by the Apple clients.
public struct IconChoice: Identifiable, Hashable, Sendable {
  public let id: String
  public let symbol: String
  public let label: String

  public init(id: String, symbol: String, label: String) {
    self.id = id
    self.symbol = symbol
    self.label = label
  }

  /// Matches against both the stored name and the human label, so searching
  /// "home" finds `house` and "chart" finds the chart icons.
  public func matches(_ query: String) -> Bool {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !needle.isEmpty else { return true }
    return id.lowercased().contains(needle) || label.lowercased().contains(needle)
  }
}

public extension IconChoice {
  /// Lucide names first, then the legacy SF-Symbol names still carried by
  /// installed templates. Both sets are valid `icon` strings on the wire.
  static let all: [IconChoice] = [
    IconChoice(id: "house", symbol: "house", label: "Home"),
    IconChoice(id: "layout-grid", symbol: "square.grid.2x2", label: "Grid"),
    IconChoice(id: "heart", symbol: "heart", label: "Health"),
    IconChoice(id: "footprints", symbol: "figure.walk", label: "Body"),
    IconChoice(id: "users", symbol: "person.2", label: "Relationships"),
    IconChoice(id: "briefcase", symbol: "briefcase", label: "Work"),
    IconChoice(id: "folder", symbol: "folder", label: "Projects"),
    IconChoice(id: "wallet", symbol: "dollarsign.circle", label: "Money"),
    IconChoice(id: "settings", symbol: "gearshape", label: "Admin"),
    IconChoice(id: "book-open", symbol: "book", label: "Learning"),
    IconChoice(id: "messages-square", symbol: "bubble.left.and.bubble.right", label: "Social"),
    IconChoice(id: "palette", symbol: "paintbrush", label: "Creative"),
    IconChoice(id: "sun", symbol: "sun.max", label: "Daily"),
    IconChoice(id: "calendar", symbol: "calendar", label: "Calendar"),
    IconChoice(id: "circle-check", symbol: "checkmark.circle", label: "Tasks"),
    IconChoice(id: "inbox", symbol: "tray.full", label: "Inbox"),
    IconChoice(id: "star", symbol: "star", label: "Starred"),
    IconChoice(id: "zap", symbol: "bolt", label: "Energy"),
    IconChoice(id: "square-dashed", symbol: "square.dashed", label: "Other"),
    IconChoice(id: "flag", symbol: "flag", label: "Goal"),
    IconChoice(id: "target", symbol: "target", label: "Target"),
    IconChoice(id: "clock", symbol: "clock", label: "Time"),
    IconChoice(id: "map-pin", symbol: "map.pin", label: "Place"),
    IconChoice(id: "sparkles", symbol: "sparkles", label: "Event"),
    IconChoice(id: "layers", symbol: "square.stack.3d.up", label: "Series"),
    IconChoice(id: "list-todo", symbol: "checklist", label: "Checklist"),
    IconChoice(id: "chart-column", symbol: "chart.bar", label: "Progress"),
    IconChoice(id: "trophy", symbol: "trophy", label: "Achievement"),
    IconChoice(id: "gift", symbol: "gift", label: "Reward"),
    IconChoice(id: "coffee", symbol: "cup.and.saucer", label: "Break"),
    IconChoice(id: "dumbbell", symbol: "dumbbell", label: "Training"),
    // Legacy names kept so a template installed by an older client still draws.
    IconChoice(id: "square.grid.2x2", symbol: "square.grid.2x2", label: "Grid"),
    IconChoice(id: "figure.walk", symbol: "figure.walk", label: "Body"),
    IconChoice(id: "person.2", symbol: "person.2", label: "Relationships"),
    IconChoice(id: "dollarsign.circle", symbol: "dollarsign.circle", label: "Money"),
    IconChoice(id: "gearshape", symbol: "gearshape", label: "Admin"),
    IconChoice(id: "book", symbol: "book", label: "Learning"),
    IconChoice(id: "bubble.left.and.bubble.right", symbol: "bubble.left.and.bubble.right", label: "Social"),
    IconChoice(id: "paintbrush", symbol: "paintbrush", label: "Creative"),
    IconChoice(id: "sun.max", symbol: "sun.max", label: "Daily"),
    IconChoice(id: "checkmark.circle", symbol: "checkmark.circle", label: "Tasks"),
    IconChoice(id: "tray.full", symbol: "tray.full", label: "Inbox"),
    IconChoice(id: "bolt", symbol: "bolt", label: "Energy"),
  ]

  /// The grid shown by every appearance picker. An empty query shows all.
  static func search(_ query: String) -> [IconChoice] {
    all.filter { $0.matches(query) }
  }
}
