/**
 * Database Reader Module
 *
 * Handles SQLite database connection and batch reading of PAF addresses
 * Uses better-sqlite3 for synchronous, high-performance SQLite access
 */

import Database from 'better-sqlite3';
import { SqliteRow } from './types';

/**
 * SQL query for batch processing
 * Joins DELIVERY_POINT, DELIVERY_POINT_GROUP, LOCALITY, and BUILDING tables
 */
const BATCH_QUERY = `
  SELECT
    dp.DELIVY_POINT_ID, dp.DELIVY_POINT_GROUP_ID,
    dp.FLAT_UNIT_TYPE, dp.FLAT_UNIT_NBR,
    dp.FLOOR_LEVEL_TYPE, dp.FLOOR_LEVEL_NBR,
    dp.HOUSE_NBR_1, dp.HOUSE_NBR_SFX_1, dp.HOUSE_NBR_2, dp.HOUSE_NBR_SFX_2,
    dp.LOT_NBR,
    dp.POSTAL_DELIVERY_NBR, dp.POSTAL_DELIVERY_NBR_PFX, dp.POSTAL_DELIVERY_NBR_SFX,
    dp.PRIMARY_POINT_IND,
    dpg.STREET_NAME, dpg.STREET_TYPE, dpg.STREET_SFX, dpg.POSTAL_DELIVERY_TYPE,
    dpg.LOCALITY_ID,
    l.LOCALITY_NAME, l.POSTCODE, l.STATE,
    b.BLDG_PROP_NAME_1
  FROM DELIVERY_POINT dp
  JOIN DELIVERY_POINT_GROUP dpg ON dp.DELIVY_POINT_GROUP_ID = dpg.DELIVY_POINT_GROUP_ID
  JOIN LOCALITY l ON dpg.LOCALITY_ID = l.LOCALITY_ID
  LEFT JOIN BUILDING b ON dp.DELIVY_POINT_ID = b.DELIVY_POINT_ID
  ORDER BY dp.DELIVY_POINT_ID
  LIMIT ? OFFSET ?
`;

const COUNT_QUERY = `
  SELECT COUNT(*) as total FROM DELIVERY_POINT
`;

/**
 * Database reader class
 * Provides batch reading capabilities for PAF address data
 */
export class DatabaseReader {
  private db: Database.Database;

  constructor(dbPath: string) {
    try {
      this.db = new Database(dbPath, { readonly: true });
      console.log(`Database connection established: ${dbPath}`);
    } catch (error) {
      console.error('Failed to open database:', error);
      throw new Error(`Failed to open database at ${dbPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total record count
   */
  getTotalCount(): number {
    try {
      const stmt = this.db.prepare(COUNT_QUERY);
      const result = stmt.get() as { total: number };
      console.log(`Total records in database: ${result.total}`);
      return result.total;
    } catch (error) {
      console.error('Failed to get record count:', error);
      throw new Error(`Failed to get record count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read a batch of records
   *
   * @param batchSize Number of records to fetch
   * @param offset Starting offset
   * @returns Array of SQLite rows
   */
  readBatch(batchSize: number, offset: number): SqliteRow[] {
    try {
      const stmt = this.db.prepare(BATCH_QUERY);
      const rows = stmt.all(batchSize, offset) as SqliteRow[];
      console.log(`Read batch: ${rows.length} records (offset: ${offset})`);
      return rows;
    } catch (error) {
      console.error(`Failed to read batch at offset ${offset}:`, error);
      throw new Error(`Failed to read batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
      // Don't throw on close error
    }
  }
}
