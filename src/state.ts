import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_IDS = 500;

export class SeenStore {
  private ids: string[];
  private set: Set<string>;

  private constructor(
    private readonly file: string,
    ids: string[],
    /** true if the state file did not exist at startup */
    readonly isFirstRun: boolean,
  ) {
    this.ids = ids;
    this.set = new Set(ids);
  }

  static async load(file: string): Promise<SeenStore> {
    if (!existsSync(file)) return new SeenStore(file, [], true);
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    const ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    return new SeenStore(file, ids, false);
  }

  has(id: string): boolean {
    return this.set.has(id);
  }

  add(id: string): void {
    if (this.set.has(id)) return;
    this.set.add(id);
    this.ids.push(id);
    if (this.ids.length > MAX_IDS) {
      const removed = this.ids.splice(0, this.ids.length - MAX_IDS);
      for (const old of removed) this.set.delete(old);
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.ids, null, 2) + "\n");
    await rename(tmp, this.file);
  }
}
