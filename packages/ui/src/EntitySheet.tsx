import type { FormEvent } from "react";
import { IconPicker } from "./IconPicker";
import type { EntityInput } from "./sheetTypes";

export interface EntitySheetProps {
  input: EntityInput;
  pending: boolean;
  error: string | null;
  isEdit: boolean;
  onChange: (patch: Partial<EntityInput>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function toLocalInput(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

const EVENT_KINDS = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
  "custom",
] as const;

export function EntitySheet({
  input,
  pending,
  error,
  isEdit,
  onChange,
  onSave,
  onCancel,
}: EntitySheetProps) {
  const id = (field: string) => `sheet-${input.kind}-${field}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave();
  }

  return (
    <form className="sheet-form" onSubmit={submit}>
      <div className="sheet-field full-width">
        <label htmlFor={id("title")}>Title</label>
        <input
          id={id("title")}
          type="text"
          maxLength={200}
          required
          autoFocus
          value={input.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      {input.kind === "event" ? (
        <>
          <div className="sheet-field">
            <label htmlFor={id("kind")}>Kind</label>
            <select
              id={id("kind")}
              value={input.eventKind ?? "day"}
              onChange={(event) => onChange({ eventKind: event.target.value })}
            >
              {EVENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div className="sheet-field">
            <label htmlFor={id("starts")}>Starts at</label>
            <input
              id={id("starts")}
              type="datetime-local"
              value={toLocalInput(input.startsAt)}
              onChange={(event) =>
                onChange({ startsAt: fromLocalInput(event.target.value) })
              }
            />
          </div>
          <div className="sheet-field">
            <label htmlFor={id("ends")}>Ends at</label>
            <input
              id={id("ends")}
              type="datetime-local"
              value={toLocalInput(input.endsAt)}
              onChange={(event) =>
                onChange({ endsAt: fromLocalInput(event.target.value) })
              }
            />
          </div>
        </>
      ) : null}

      {input.kind === "progression" ? (
        <>
          <div className="sheet-field">
            <label htmlFor={id("mode")}>Mode</label>
            <select
              id={id("mode")}
              value={input.mode ?? "meter"}
              onChange={(event) =>
                onChange({ mode: event.target.value as "steps" | "meter" })
              }
            >
              <option value="meter">meter</option>
              <option value="steps">steps</option>
            </select>
          </div>
          <div className="sheet-field">
            <label htmlFor={id("target")}>Target</label>
            <input
              id={id("target")}
              type="number"
              min={1}
              step={1}
              value={input.target ?? 1}
              onChange={(event) =>
                onChange({ target: Number(event.target.value) })
              }
            />
          </div>
          <div className="sheet-field">
            <label htmlFor={id("unit")}>Unit</label>
            <input
              id={id("unit")}
              type="text"
              value={input.unit ?? ""}
              placeholder="pages, km, steps…"
              onChange={(event) => onChange({ unit: event.target.value })}
            />
          </div>
        </>
      ) : null}

      {input.kind === "resource" ? (
        <>
          <div className="sheet-field">
            <label htmlFor={id("quantity")}>Quantity</label>
            <input
              id={id("quantity")}
              type="number"
              step="0.01"
              value={input.quantity ?? 0}
              onChange={(event) =>
                onChange({ quantity: Number(event.target.value) })
              }
            />
          </div>
          <div className="sheet-field">
            <label htmlFor={id("unit")}>Unit</label>
            <input
              id={id("unit")}
              type="text"
              value={input.unit ?? ""}
              onChange={(event) => onChange({ unit: event.target.value })}
            />
          </div>
          <div className="sheet-field">
            <label htmlFor={id("low")}>Low at</label>
            <input
              id={id("low")}
              type="number"
              step="0.01"
              value={input.lowAt ?? ""}
              onChange={(event) =>
                onChange({
                  lowAt: event.target.value.trim()
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </>
      ) : null}

      <div className="full-width">
        <IconPicker
          label="Appearance"
          icon={input.icon}
          color={input.color}
          onIconChange={(icon) => onChange({ icon })}
          onColorChange={(color) => onChange({ color })}
        />
      </div>

      {error ? (
        <p className="error sheet-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sheet-actions full-width">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-save" disabled={pending || !input.title.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : `Create ${input.kind}`}
        </button>
      </div>
    </form>
  );
}
