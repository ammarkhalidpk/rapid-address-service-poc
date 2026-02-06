/**
 * Database Reader Module
 *
 * Handles SQLite database connection and batch reading of PAF addresses
 * Uses sql.js for pure JavaScript SQLite access (no native bindings required)
 * Uses sql-wasm-debug.js which includes WASM inline (no external file needed)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js/dist/sql-asm.js';
import * as fs from 'fs';
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
 * Database reader class using sql.js
 * Provides batch reading capabilities for PAF address data
 */
export class DatabaseReader {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database connection
   * Must be called before any other methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log(`Initializing sql.js and loading database: ${this.dbPath}`);

      // Initialize sql.js with asm.js (no WASM file needed)
      const SQL = await initSqlJs();

      // Read the database file
      const fileBuffer = fs.readFileSync(this.dbPath);
      console.log(`Database file size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Create database from buffer
      this.db = new SQL.Database(fileBuffer);
      this.initialized = true;

      console.log(`Database connection established: ${this.dbPath}`);
    } catch (error) {
      console.error('Failed to open database:', error);
      throw new Error(`Failed to open database at ${this.dbPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }

  /**
   * Get total record count
   */
  getTotalCount(): number {
    this.ensureInitialized();

    try {
      const result = this.db!.exec(COUNT_QUERY);
      if (result.length === 0 || result[0].values.length === 0) {
        return 0;
      }
      const total = result[0].values[0][0] as number;
      console.log(`Total records in database: ${total}`);
      return total;
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
    this.ensureInitialized();

    try {
      // Prepare and run the query with parameters
      const stmt = this.db!.prepare(BATCH_QUERY);
      stmt.bind([batchSize, offset]);

      const rows: SqliteRow[] = [];
      const columns = [
        'DELIVY_POINT_ID', 'DELIVY_POINT_GROUP_ID',
        'FLAT_UNIT_TYPE', 'FLAT_UNIT_NBR',
        'FLOOR_LEVEL_TYPE', 'FLOOR_LEVEL_NBR',
        'HOUSE_NBR_1', 'HOUSE_NBR_SFX_1', 'HOUSE_NBR_2', 'HOUSE_NBR_SFX_2',
        'LOT_NBR',
        'POSTAL_DELIVERY_NBR', 'POSTAL_DELIVERY_NBR_PFX', 'POSTAL_DELIVERY_NBR_SFX',
        'PRIMARY_POINT_IND',
        'STREET_NAME', 'STREET_TYPE', 'STREET_SFX', 'POSTAL_DELIVERY_TYPE',
        'LOCALITY_ID',
        'LOCALITY_NAME', 'POSTCODE', 'STATE',
        'BLDG_PROP_NAME_1'
      ];

      while (stmt.step()) {
        const values = stmt.get();
        const row: Record<string, unknown> = {};

        columns.forEach((col, idx) => {
          row[col] = values[idx];
        });

        rows.push(row as SqliteRow);
      }

      stmt.free();

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
      if (this.db) {
        this.db.close();
        this.db = null;
        this.initialized = false;
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database:', error);
      // Don't throw on close error
    }
  }
}
