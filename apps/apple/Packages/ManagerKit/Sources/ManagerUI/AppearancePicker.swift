import ManagerCore
import SwiftUI

/// The only way to choose an icon or color. There is no text field for a
/// Lucide name: the grid is searchable and every choice is drawn from the
/// catalog, so a stored appearance can never be a typo.
public struct AppearancePicker: View {
  @Binding public var icon: String
  @Binding public var color: String

  private let previewTitle: String?
  @State private var query = ""

  private let columns = [GridItem(.adaptive(minimum: 46), spacing: 8)]

  public init(
    icon: Binding<String>,
    color: Binding<String>,
    previewTitle: String? = nil
  ) {
    self._icon = icon
    self._color = color
    self.previewTitle = previewTitle
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 8) {
        Image(systemName: "magnifyingglass")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.managerMuted)
        TextField("Search icons", text: $query)
          .textFieldStyle(.plain)
          .font(ManagerFont.meta)
          .accessibilityLabel("Search icons")
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 7)
      .background(
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(Color.managerRaised)
      )

      ScrollView(.vertical) {
        LazyVGrid(columns: columns, spacing: 8) {
          ForEach(IconChoice.search(query)) { choice in
            Button {
              icon = choice.id
            } label: {
              Image(systemName: choice.symbol)
                .font(.system(size: 18, weight: .medium))
                .frame(maxWidth: .infinity, minHeight: 42)
                .foregroundStyle(choice.id == icon ? Color.managerAccentInk : Color.managerInk)
                .background(
                  RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(
                      choice.id == icon
                        ? Color.managerAccent
                        : Color.managerRaised
                    )
                )
                .overlay {
                  RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(
                      choice.id == icon ? Color.clear : Color.managerBorder,
                      lineWidth: 1
                    )
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(choice.label)
            .accessibilityAddTraits(choice.id == icon ? .isSelected : [])
          }
        }
      }
      .frame(maxHeight: 170)
      .accessibilityLabel("Icon grid")

      VStack(alignment: .leading, spacing: 6) {
        Text("Color")
          .font(.system(.caption2).weight(.semibold))
          .tracking(1.2)
          .foregroundStyle(Color.managerMuted)
        HStack(spacing: 10) {
          ForEach(Appearance.colorTokens, id: \.self) { token in
            Button {
              color = token
            } label: {
              Circle()
                .fill(Color.boardColor(token))
                .frame(width: 26, height: 26)
                .overlay {
                  Circle()
                    .strokeBorder(
                      token == color ? Color.managerInk : Color.clear,
                      lineWidth: 2
                    )
                }
                .padding(2)
                .overlay {
                  Circle()
                    .strokeBorder(Color.managerBorder, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(token)
            .accessibilityAddTraits(token == color ? .isSelected : [])
          }
        }
      }

      HStack(spacing: 10) {
        Image(systemName: Appearance.symbol(for: icon))
          .font(.system(size: 22, weight: .medium))
          .foregroundStyle(Color.boardColor(color))
          .frame(width: 36)
        Text(previewTitle ?? "Preview")
          .font(ManagerFont.rowTitle.weight(.semibold))
          .foregroundStyle(Color.managerInk)
        Spacer(minLength: 0)
      }
      .padding(12)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(Color.managerSurface)
      )
      .overlay {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .strokeBorder(Color.managerBorder)
      }
      .accessibilityElement(children: .combine)
      .accessibilityLabel("Appearance preview")
    }
  }
}
