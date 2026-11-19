import Foundation

/// Title rules, mirrored from `packages/backend/convex/lib/taskFields.ts`.
///
/// The backend is the source of truth and rejects anything else; validating in
/// the client only makes the failure local and instant.
public enum TaskTitle {
  public static let maxLength = 200

  /// Returns the trimmed title, or `nil` when the backend would reject it.
  public static func normalized(_ raw: String) -> String? {
    let title = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty, title.count <= maxLength else { return nil }
    return title
  }

  public static func isValid(_ raw: String) -> Bool {
    normalized(raw) != nil
  }

  /// Characters left before the limit, for the composer's counter.
  public static func remaining(_ raw: String) -> Int {
    max(0, maxLength - raw.trimmingCharacters(in: .whitespacesAndNewlines).count)
  }
}
