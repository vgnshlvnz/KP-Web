import { ResolvedBirthChartInput } from './types';

/**
 * In-memory repository for storing birth chart inputs.
 * Designed to be easily backed by Cloudflare D1 or KV storage.
 */
export class ChartInputStorage {
  private store: Map<string, ResolvedBirthChartInput> = new Map();

  /**
   * Saves a resolved birth chart input containing full raw input and computed resolution.
   */
  async save(record: ResolvedBirthChartInput): Promise<ResolvedBirthChartInput> {
    this.store.set(record.id, record);
    return record;
  }

  /**
   * Retrieves a chart input record by ID.
   */
  async get(id: string): Promise<ResolvedBirthChartInput | undefined> {
    return this.store.get(id);
  }

  /**
   * Lists recently stored chart inputs.
   */
  async list(limit: number = 20): Promise<ResolvedBirthChartInput[]> {
    return Array.from(this.store.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Clears stored inputs (primarily for testing).
   */
  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const defaultStorage = new ChartInputStorage();
