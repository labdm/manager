import type { FormEvent } from "react";
import { PRIORITY_SEEDS } from "./taskFacts";
import type { OverduePolicy, TaskDraft } from "./taskTypes";
import {
  SERIES_BEHAVIORS,
  SERIES_CADENCES,
  TASK_LOOKS,
  type SeriesBehavior,
  type SeriesCadence,
  type TaskLook,
} from "./sheetTypes";
import type { ResourceItem } from "./sheetTypes";

export interface TaskSheetProps {
  draft: TaskDraft;
  resources: ResourceItem[];
  isEdit: boolean;
  pending: boolean;
  error: string | null;
  onChange: (patch: Partial<TaskDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function TaskSheet({
  draft,
  resources,
  isEdit,
  pending,
  error,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: TaskSheetProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave();
  }

  return (
    <form className="sheet-form" onSubmit={submit}>
      <div className="sheet-field full-width">
        <label htmlFor="sheet-task-title">Title</label>
        <input
          id="sheet-task-title"
          type="text"
          maxLength={200}
          required
          autoFocus
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      <fieldset className="sheet-fieldset full-width">
        <legend>Look</legend>
        <p className="field-hint">
          Check is a checkbox row, row is a line, card is a card. Absent look
          means check.
        </p>
        <div className="segmented" role="group" aria-label="Task look">
          {TASK_LOOKS.map((look) => (
            <button
              type="button"
              key={look.id}
              className={`segment ${draft.look === look.id ? "selected" : ""}`}
              aria-pressed={draft.look === look.id}
              onClick={() => onChange({ look: look.id as TaskLook })}
            >
              {look.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-fieldset full-width">
        <legend>Series</legend>
        <p className="field-hint">
          The series declares its own behavior. Cadence never implies one.
        </p>
        <div className="segmented" role="group" aria-label="Series behavior">
          {SERIES_BEHAVIORS.map((behavior) => (
            <button
              type="button"
              key={behavior.id}
              className={`segment ${draft.series === behavior.id ? "selected" : ""}`}
              aria-pressed={draft.series === behavior.id}
              disabled={isEdit}
              title={behavior.detail}
              onClick={() =>
                onChange({ series: behavior.id as SeriesBehavior })
              }
            >
              {behavior.label}
            </button>
          ))}
        </div>
        {isEdit ? (
          <p className="field-hint">
            An existing occurrence keeps its series. Look and details can
            still change.
          </p>
        ) : null}

        <div className="sheet-field">
          <label htmlFor="sheet-cadence">Cadence</label>
          <select
            id="sheet-cadence"
            value={draft.cadence}
            disabled={isEdit || draft.series === "none"}
            onChange={(event) =>
              onChange({ cadence: event.target.value as SeriesCadence })
            }
          >
            {SERIES_CADENCES.map((cadence) => (
              <option key={cadence.id} value={cadence.id}>
                {cadence.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="sheet-field">
        <label htmlFor="sheet-planned-day">Planned day</label>
        <input
          id="sheet-planned-day"
          type="date"
          value={draft.plannedDay}
          onChange={(event) => onChange({ plannedDay: event.target.value })}
        />
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-planned-time">Planned time</label>
        <input
          id="sheet-planned-time"
          type="time"
          value={draft.plannedTime}
          onChange={(event) => onChange({ plannedTime: event.target.value })}
        />
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-deadline">Deadline</label>
        <input
          id="sheet-deadline"
          type="datetime-local"
          value={draft.deadline}
          onChange={(event) => onChange({ deadline: event.target.value })}
        />
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-remind">Remind at</label>
        <input
          id="sheet-remind"
          type="datetime-local"
          value={draft.remindAt}
          onChange={(event) => onChange({ remindAt: event.target.value })}
        />
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-location">Location</label>
        <input
          id="sheet-location"
          type="text"
          value={draft.location}
          placeholder="Where"
          onChange={(event) => onChange({ location: event.target.value })}
        />
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-priority">Priority</label>
        <select
          id="sheet-priority"
          value={draft.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        >
          {Object.keys(PRIORITY_SEEDS).map((seed) => (
            <option key={seed} value={seed}>
              {seed}
            </option>
          ))}
        </select>
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-policy">Overdue policy</label>
        <select
          id="sheet-policy"
          value={draft.overduePolicy}
          onChange={(event) =>
            onChange({ overduePolicy: event.target.value as OverduePolicy })
          }
        >
          <option value="none">none</option>
          <option value="retire">retire</option>
          <option value="escalate">escalate</option>
        </select>
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-resource">Resource effect</label>
        <select
          id="sheet-resource"
          value={draft.resourceId}
          onChange={(event) => onChange({ resourceId: event.target.value })}
        >
          <option value="">No resource</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.title}
            </option>
          ))}
        </select>
      </div>

      <div className="sheet-field">
        <label htmlFor="sheet-resource-delta">Resource delta</label>
        <input
          id="sheet-resource-delta"
          type="number"
          step="1"
          value={draft.resourceDelta}
          disabled={!draft.resourceId}
          onChange={(event) =>
            onChange({ resourceDelta: event.target.value })
          }
        />
      </div>

      <div className="sheet-field full-width">
        <label htmlFor="sheet-notes">Notes</label>
        <textarea
          id="sheet-notes"
          rows={3}
          value={draft.notes}
          placeholder="Add notes…"
          onChange={(event) => onChange({ notes: event.target.value })}
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
        <button type="submit" className="btn-save" disabled={pending || !draft.title.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </button>
        {isEdit && onDelete ? (
          <button
            type="button"
            className="btn-delete-editor"
            onClick={onDelete}
          >
            Delete task
          </button>
        ) : null}
      </div>
    </form>
  );
}
