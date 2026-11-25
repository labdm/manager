import type { Doc, Id } from "../convex/_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../convex/_generated/server";
import { createDefaultGroup } from "../convex/lib/groupService";

type Row = {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
};

class QueryStub {
  private filters: Record<string, unknown> = {};

  constructor(private readonly rows: Row[]) {}

  withIndex(
    _name: string,
    builder: (q: { eq: (field: string, value: unknown) => void }) => void,
  ): QueryStub {
    const collector = {
      eq: (field: string, value: unknown) => {
        this.filters[field] = value;
        return collector;
      },
    };
    builder(collector);
    return this;
  }

  collect(): Row[] {
    return this.rows.filter((row) =>
      Object.entries(this.filters).every(([field, value]) => row[field] === value),
    );
  }

  first(): Row | null {
    return this.collect()[0] ?? null;
  }

  unique(): Row | null {
    const rows = this.collect();
    if (rows.length > 1) throw new Error("Expected at most one row");
    return rows[0] ?? null;
  }
}

export class FakeDb {
  private readonly rows = new Map<string, Row>();
  private counter = 0;

  all(table: string): Row[] {
    return Array.from(this.rows.values()).filter((row) => row._id.startsWith(`${table}-`));
  }

  async get(id: string): Promise<Row | null> {
    return this.rows.get(id) ?? null;
  }

  async insert(table: string, value: Record<string, unknown>): Promise<string> {
    this.counter += 1;
    const id = `${table}-${this.counter}`;
    this.rows.set(id, {
      ...value,
      _id: id,
      _creationTime: this.counter,
    });
    return id;
  }

  /** Test-only insert with a stable id, for fixture users with Clerk-style ids. */
  seed(table: string, id: string, value: Record<string, unknown>): void {
    this.counter += 1;
    this.rows.set(id, {
      ...value,
      _id: id,
      _creationTime: this.counter,
    });
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`No row ${id}`);
    const next = { ...row };
    for (const [key, field] of Object.entries(value)) {
      if (field === undefined) delete next[key];
      else next[key] = field;
    }
    this.rows.set(id, next);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  query(table: string): QueryStub {
    return new QueryStub(this.all(table));
  }

  asWriter(): DatabaseWriter {
    return this as unknown as DatabaseWriter;
  }

  asReader(): DatabaseReader {
    return this as unknown as DatabaseReader;
  }
}

export function fakeDb(): FakeDb {
  return new FakeDb();
}

/** Every test user is provisioned the same way as `users.upsert`. */
export async function seedUser(
  db: FakeDb,
  userId: Id<"users">,
  input: { email?: string; role?: Doc<"users">["role"]; name?: string } = {},
): Promise<{ user: Doc<"users">; group: Doc<"spaces"> }> {
  const writer = db.asWriter();
  db.seed("users", String(userId), {
    tokenIdentifier: `test|${String(userId)}`,
    name: input.name,
    email: input.email,
    role: input.role ?? "user",
    activityOnTasks: "others",
  });
  const group = await createDefaultGroup(writer, userId, 1);
  const user = await db.get(userId);
  if (!user) throw new Error("User not found");
  return {
    user: user as unknown as Doc<"users">,
    group,
  };
}
