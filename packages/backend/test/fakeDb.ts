import type { DatabaseReader, DatabaseWriter } from "../convex/_generated/server";

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
