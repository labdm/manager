import { useState } from "react";
import { COLOR_TOKENS, normalizeColorToken, type ColorToken } from "./homeCatalog";
import { iconChoices, resolveLucideIcon } from "./iconCatalog";

/**
 * Appearance editor. Names are picked from the Lucide grid; the only text
 * field searches that grid and never accepts an icon name as a value.
 */
export function IconPicker({
  icon,
  color,
  label,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  color: string;
  label: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}) {
  const [query, setQuery] = useState("");
  const token = normalizeColorToken(color);
  const choices = iconChoices(query);
  const PreviewIcon = resolveLucideIcon(icon);

  return (
    <fieldset className="icon-picker">
      <legend>{label}</legend>

      <div className="icon-preview-row">
        <span
          className={`icon-preview color-${token}`}
          data-testid="icon-preview"
        >
          <PreviewIcon aria-hidden="true" size={22} strokeWidth={1.8} />
        </span>
        <span className="icon-preview-caption">
          {icon || "circle"} · {token}
        </span>
      </div>

      <input
        className="icon-search"
        type="search"
        aria-label={`Search ${label.toLowerCase()} icons`}
        placeholder="Search icons"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="icon-grid" role="group" aria-label={`${label} icons`}>
        {choices.map((choice) => {
          const ChoiceIcon = choice.icon;
          const selected = choice.name === icon;
          return (
            <button
              type="button"
              key={choice.name}
              className={`icon-choice ${selected ? "selected" : ""}`}
              aria-label={`Use ${choice.name} icon`}
              aria-pressed={selected}
              onClick={() => onIconChange(choice.name)}
            >
              <ChoiceIcon aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>

      <div className="palette-row" role="group" aria-label={`${label} colors`}>
        {COLOR_TOKENS.map((swatch: ColorToken) => (
          <button
            type="button"
            key={swatch}
            className={`palette-swatch color-${swatch} ${
              swatch === token ? "selected" : ""
            }`}
            aria-label={`Use ${swatch} color`}
            aria-pressed={swatch === token}
            onClick={() => onColorChange(swatch)}
          />
        ))}
      </div>
    </fieldset>
  );
}
