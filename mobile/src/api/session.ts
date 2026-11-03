export interface TokenStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

// Serialize credential changes so a late refresh cannot overwrite a new login.
export class SessionTokens {
  revision = 0;
  private writes: Promise<void> = Promise.resolve();
  constructor(private storage: TokenStorage) {}
  async get(key: string) {
    await this.writes;
    return this.storage.getItemAsync(key);
  }
  private enqueue(work: () => Promise<void>) {
    const next = this.writes.then(work, work);
    this.writes = next.catch(() => {});
    return next;
  }
  replace(access: string, refresh: string) {
    this.revision++;
    return this.enqueue(async () => {
      await this.storage.setItemAsync('access_token', access);
      await this.storage.setItemAsync('refresh_token', refresh);
    });
  }
  refresh(access: string, refresh: string, revision: number) {
    return this.enqueue(async () => {
      if (revision !== this.revision) return;
      await this.storage.setItemAsync('access_token', access);
      await this.storage.setItemAsync('refresh_token', refresh);
    });
  }
  clear() {
    this.revision++;
    return this.enqueue(async () => {
      await this.storage.deleteItemAsync('access_token');
      await this.storage.deleteItemAsync('refresh_token');
    });
  }
}
