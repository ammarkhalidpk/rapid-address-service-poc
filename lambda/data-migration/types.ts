/**
 * Type definitions for Data Migration Lambda
 *
 * Defines interfaces for SQLite row structure, OpenSearch document format,
 * and migration progress tracking
 */

/**
 * SQLite row structure from PAF database
 * Represents a joined query result from DELIVERY_POINT, DELIVERY_POINT_GROUP,
 * LOCALITY, and BUILDING tables
 */
export interface SqliteRow {
  DELIVY_POINT_ID: number;
  DELIVY_POINT_GROUP_ID: number;
  FLAT_UNIT_TYPE: string | null;
  FLAT_UNIT_NBR: string | null;
  FLOOR_LEVEL_TYPE: string | null;
  FLOOR_LEVEL_NBR: string | null;
  HOUSE_NBR_1: number | null;
  HOUSE_NBR_SFX_1: string | null;
  HOUSE_NBR_2: number | null;
  HOUSE_NBR_SFX_2: string | null;
  LOT_NBR: string | null;
  POSTAL_DELIVERY_NBR: number | null;
  POSTAL_DELIVERY_NBR_PFX: string | null;
  POSTAL_DELIVERY_NBR_SFX: string | null;
  PRIMARY_POINT_IND: string | null;
  STREET_NAME: string | null;
  STREET_TYPE: string | null;
  STREET_SFX: string | null;
  POSTAL_DELIVERY_TYPE: string | null;
  LOCALITY_ID: number;
  LOCALITY_NAME: string;
  POSTCODE: string;
  STATE: string;
  BLDG_PROP_NAME_1: string | null;
}

/**
 * OpenSearch document structure
 * Matches the index mapping defined in docs/opensearch-index-mapping.json
 */
export interface OpenSearchDocument {
  delivery_point_id: number;
  delivery_point_group_id: number;
  locality_id: number;
  unit?: {
    type?: string;
    number?: string;
    full?: string;
  };
  floor?: {
    type?: string;
    number?: string;
    full?: string;
  };
  building_name?: string;
  street_number?: {
    number_1?: number;
    suffix_1?: string;
    number_2?: number;
    suffix_2?: string;
    full?: string;
  };
  lot_number?: string;
  street?: {
    name?: string;
    type?: string;
    suffix?: string;
    full?: string;
  };
  postal_delivery?: {
    type?: string;
    number?: number;
    prefix?: string;
    suffix?: string;
    full?: string;
  };
  locality: {
    name: string;
    postcode: string;
    state: string;
  };
  primary_point_indicator?: string;
  formatted_address: string;
  formatted_address_short?: string;
  search_text: string;
}

/**
 * Migration progress tracking
 */
export interface MigrationProgress {
  totalRecords: number;
  processedRecords: number;
  indexedRecords: number;
  failedRecords: number;
  batchNumber: number;
  startTime: number;
  lastBatchTime: number;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  batchNumber: number;
  recordsProcessed: number;
  recordsIndexed: number;
  recordsFailed: number;
  durationMs: number;
}

/**
 * Lambda event structure (can be extended for Step Functions)
 */
export interface MigrationEvent {
  s3Bucket: string;
  s3Key: string;
  batchSize?: number;
  startOffset?: number;
  maxRecords?: number;
}

/**
 * Lambda response structure
 */
export interface MigrationResponse {
  success: boolean;
  message: string;
  totalRecords: number;
  processedRecords: number;
  indexedRecords: number;
  failedRecords: number;
  batches: BatchResult[];
  durationMs: number;
  error?: string;
}
