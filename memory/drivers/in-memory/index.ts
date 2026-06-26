export class InMemoryDriver {
  private store = new Map<string, unknown>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, value: unknown) { this.store.set(key, value); }
  async delete(key: string) { this.store.delete(key); }
  async clear() { this.store.clear(); }
}
