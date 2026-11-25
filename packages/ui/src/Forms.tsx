import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import type { ActivityValue, TaskFormDraft } from "./shellTypes";

export function FormFrame({
  title,
  onCancel,
  error,
  children,
}: {
  title: string;
  onCancel: () => void;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <section
      className="flex h-full flex-col gap-4 overflow-y-auto p-4"
      aria-label={title}
    >
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={onCancel}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function TaskForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (draft: TaskFormDraft) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [draft, setDraft] = useState<TaskFormDraft>({
    title: "",
    plannedDay: "",
    series: "none",
    cadence: "daily",
  });
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || pending) return;
    setPending(true);
    try {
      await onSubmit(draft);
    } finally {
      setPending(false);
    }
  }

  return (
    <FormFrame title="New task" onCancel={onCancel} error={error}>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Title">
          <Input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="What needs doing?"
          />
        </Field>
        <Field label="Planned day">
          <Input
            type="date"
            value={draft.plannedDay}
            onChange={(event) => setDraft({ ...draft, plannedDay: event.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Series</legend>
          {(["none", "replace", "stack"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="series"
                value={value}
                checked={draft.series === value}
                onChange={() => setDraft({ ...draft, series: value })}
              />
              {value === "none"
                ? "None — one task"
                : value === "replace"
                  ? "Replace — one open occurrence"
                  : "Stack — one open occurrence per period"}
            </label>
          ))}
        </fieldset>
        <Field label="Cadence">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.cadence}
            onChange={(event) =>
              setDraft({ ...draft, cadence: event.target.value as TaskFormDraft["cadence"] })
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="every 14 days">Every 14 days</option>
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          Create task
        </Button>
      </form>
    </FormFrame>
  );
}

export function MessageForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (title: string, body: string) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <FormFrame title="New message" onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) void onSubmit(title.trim(), body.trim());
        }}
      >
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Body">
          <Input value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <Button type="submit">Send message</Button>
      </form>
    </FormFrame>
  );
}

export function NameForm({
  title,
  label,
  buttonLabel,
  onSubmit,
  onCancel,
  error,
}: {
  title: string;
  label: string;
  buttonLabel: string;
  onSubmit: (value: string) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [value, setValue] = useState("");
  return (
    <FormFrame title={title} onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) void onSubmit(value.trim());
        }}
      >
        <Field label={label}>
          <Input value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
        <Button type="submit">{buttonLabel}</Button>
      </form>
    </FormFrame>
  );
}

export function InviteForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (email: string) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [email, setEmail] = useState("");
  return (
    <FormFrame title="Invite to group" onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) void onSubmit(email.trim());
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit">Send invite</Button>
      </form>
    </FormFrame>
  );
}

export function ResourceForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (title: string, quantity: number) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("0");
  return (
    <FormFrame title="New resource" onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) void onSubmit(title.trim(), Number(quantity) || 0);
        }}
      >
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Quantity">
          <Input
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Button type="submit">Create resource</Button>
      </form>
    </FormFrame>
  );
}

export function RoutingForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (name: string, cadence: "daily" | "weekly" | "monthly", title: string) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("daily");
  const [title, setTitle] = useState("");
  return (
    <FormFrame title="New routing" onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && title.trim()) void onSubmit(name.trim(), cadence, title.trim());
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Cadence">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={cadence}
            onChange={(event) =>
              setCadence(event.target.value as "daily" | "weekly" | "monthly")
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Task title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Button type="submit">Create routing</Button>
      </form>
    </FormFrame>
  );
}

export function ProgressionForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (title: string, target: number, unit: string) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  return (
    <FormFrame title="New progression" onCancel={onCancel} error={error}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(target);
          if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
          void onSubmit(title.trim(), parsed, unit.trim());
        }}
      >
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Target">
          <Input type="number" value={target} onChange={(event) => setTarget(event.target.value)} />
        </Field>
        <Field label="Unit">
          <Input value={unit} onChange={(event) => setUnit(event.target.value)} />
        </Field>
        <Button type="submit">Create progression</Button>
      </form>
    </FormFrame>
  );
}

export function ProgressionLogForm({ onLog }: { onLog: (amount: number) => void }) {
  const [amount, setAmount] = useState("1");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label="Log progress"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(amount);
        if (!Number.isFinite(parsed) || parsed === 0) return;
        onLog(parsed);
      }}
    >
      <Field label="Amount">
        <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Button type="submit">Log</Button>
    </form>
  );
}

export function QuestStepForm({
  tasks,
  onAdd,
}: {
  tasks: ReadonlyArray<{ id: string; title: string }>;
  onAdd: (taskId: string) => void;
}) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  if (!tasks.length) {
    return <p className="text-sm text-muted-foreground">Create a task before adding a step.</p>;
  }
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Add quest step"
      onSubmit={(event) => {
        event.preventDefault();
        if (taskId) onAdd(taskId);
      }}
    >
      <Field label="Step task">
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={taskId}
          onChange={(event) => setTaskId(event.target.value)}
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" className="self-start">
        Add step
      </Button>
    </form>
  );
}

export function ActivityControl({
  value,
  onChange,
}: {
  value: ActivityValue;
  onChange: (value: ActivityValue) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Activity on Tasks</legend>
      <p className="text-xs text-muted-foreground">
        Choose which activity records appear on the Tasks page. Messages always show in History.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["others", "all", "none"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? "default" : "outline"}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option === "others" ? "Others" : option === "all" ? "All" : "None"}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
