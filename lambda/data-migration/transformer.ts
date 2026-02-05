/**
 * Document Transformer Module
 *
 * Transforms SQLite row data to OpenSearch document format
 * Handles address formatting, null values, and search text generation
 */

import { SqliteRow, OpenSearchDocument } from './types';

/**
 * Transform SQLite row to OpenSearch document
 *
 * @param row SQLite row from PAF database
 * @returns OpenSearch document ready for indexing
 */
export function transformToDocument(row: SqliteRow): OpenSearchDocument {
  const doc: OpenSearchDocument = {
    delivery_point_id: row.DELIVY_POINT_ID,
    delivery_point_group_id: row.DELIVY_POINT_GROUP_ID,
    locality_id: row.LOCALITY_ID,
    locality: {
      name: row.LOCALITY_NAME,
      postcode: row.POSTCODE,
      state: row.STATE,
    },
    formatted_address: '',
    search_text: '',
  };

  // Unit (Flat/Apartment)
  if (row.FLAT_UNIT_TYPE || row.FLAT_UNIT_NBR) {
    const unitFull = formatUnit(row.FLAT_UNIT_TYPE, row.FLAT_UNIT_NBR);
    doc.unit = {
      type: row.FLAT_UNIT_TYPE || undefined,
      number: row.FLAT_UNIT_NBR || undefined,
      full: unitFull,
    };
  }

  // Floor
  if (row.FLOOR_LEVEL_TYPE || row.FLOOR_LEVEL_NBR) {
    const floorFull = formatFloor(row.FLOOR_LEVEL_TYPE, row.FLOOR_LEVEL_NBR);
    doc.floor = {
      type: row.FLOOR_LEVEL_TYPE || undefined,
      number: row.FLOOR_LEVEL_NBR || undefined,
      full: floorFull,
    };
  }

  // Building name
  if (row.BLDG_PROP_NAME_1) {
    doc.building_name = row.BLDG_PROP_NAME_1;
  }

  // Street number
  if (row.HOUSE_NBR_1 !== null || row.HOUSE_NBR_2 !== null) {
    const streetNumberFull = formatStreetNumber(
      row.HOUSE_NBR_1,
      row.HOUSE_NBR_SFX_1,
      row.HOUSE_NBR_2,
      row.HOUSE_NBR_SFX_2
    );
    doc.street_number = {
      number_1: row.HOUSE_NBR_1 !== null ? row.HOUSE_NBR_1 : undefined,
      suffix_1: row.HOUSE_NBR_SFX_1 || undefined,
      number_2: row.HOUSE_NBR_2 !== null ? row.HOUSE_NBR_2 : undefined,
      suffix_2: row.HOUSE_NBR_SFX_2 || undefined,
      full: streetNumberFull,
    };
  }

  // Lot number
  if (row.LOT_NBR) {
    doc.lot_number = row.LOT_NBR;
  }

  // Street
  if (row.STREET_NAME || row.STREET_TYPE || row.STREET_SFX) {
    const streetFull = formatStreet(row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX);
    doc.street = {
      name: row.STREET_NAME || undefined,
      type: row.STREET_TYPE || undefined,
      suffix: row.STREET_SFX || undefined,
      full: streetFull,
    };
  }

  // Postal delivery
  if (row.POSTAL_DELIVERY_TYPE || row.POSTAL_DELIVERY_NBR !== null) {
    const postalFull = formatPostalDelivery(
      row.POSTAL_DELIVERY_TYPE,
      row.POSTAL_DELIVERY_NBR,
      row.POSTAL_DELIVERY_NBR_PFX,
      row.POSTAL_DELIVERY_NBR_SFX
    );
    doc.postal_delivery = {
      type: row.POSTAL_DELIVERY_TYPE || undefined,
      number: row.POSTAL_DELIVERY_NBR !== null ? row.POSTAL_DELIVERY_NBR : undefined,
      prefix: row.POSTAL_DELIVERY_NBR_PFX || undefined,
      suffix: row.POSTAL_DELIVERY_NBR_SFX || undefined,
      full: postalFull,
    };
  }

  // Primary point indicator
  if (row.PRIMARY_POINT_IND) {
    doc.primary_point_indicator = row.PRIMARY_POINT_IND;
  }

  // Generate formatted address
  doc.formatted_address = formatFullAddress(row, doc);
  doc.formatted_address_short = formatShortAddress(row, doc);

  // Generate search text (all searchable fields concatenated)
  doc.search_text = generateSearchText(row, doc);

  return doc;
}

/**
 * Format unit (flat/apartment) string
 */
function formatUnit(type: string | null, number: string | null): string | undefined {
  const parts: string[] = [];
  if (type) parts.push(type);
  if (number) parts.push(number);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Format floor string
 */
function formatFloor(type: string | null, number: string | null): string | undefined {
  const parts: string[] = [];
  if (type) parts.push(type);
  if (number) parts.push(number);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Format street number (handles ranges like 123A-125B)
 */
function formatStreetNumber(
  num1: number | null,
  sfx1: string | null,
  num2: number | null,
  sfx2: string | null
): string | undefined {
  if (num1 === null && num2 === null) return undefined;

  const parts: string[] = [];

  if (num1 !== null) {
    parts.push(`${num1}${sfx1 || ''}`);
  }

  if (num2 !== null) {
    parts.push(`${num2}${sfx2 || ''}`);
  }

  return parts.length > 0 ? parts.join('-') : undefined;
}

/**
 * Format street string
 */
function formatStreet(
  name: string | null,
  type: string | null,
  suffix: string | null
): string | undefined {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (type) parts.push(type);
  if (suffix) parts.push(suffix);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Format postal delivery string (e.g., "PO BOX 123")
 */
function formatPostalDelivery(
  type: string | null,
  number: number | null,
  prefix: string | null,
  suffix: string | null
): string | undefined {
  if (!type && number === null) return undefined;

  const parts: string[] = [];
  if (type) parts.push(type);
  if (prefix) parts.push(prefix);
  if (number !== null) parts.push(number.toString());
  if (suffix) parts.push(suffix);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Format full address
 * Example: "Unit 5, Level 2, 123A George Street, Sydney NSW 2000"
 */
function formatFullAddress(row: SqliteRow, doc: OpenSearchDocument): string {
  const parts: string[] = [];

  // Unit
  if (doc.unit?.full) {
    parts.push(doc.unit.full);
  }

  // Floor
  if (doc.floor?.full) {
    parts.push(doc.floor.full);
  }

  // Building name
  if (doc.building_name) {
    parts.push(doc.building_name);
  }

  // Street number and street
  const streetParts: string[] = [];
  if (doc.street_number?.full) {
    streetParts.push(doc.street_number.full);
  }
  if (doc.street?.full) {
    streetParts.push(doc.street.full);
  }
  if (streetParts.length > 0) {
    parts.push(streetParts.join(' '));
  }

  // Postal delivery (alternative to street address)
  if (doc.postal_delivery?.full) {
    parts.push(doc.postal_delivery.full);
  }

  // Locality, state, postcode
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);

  return parts.join(', ');
}

/**
 * Format short address (without unit/floor)
 * Example: "123A George Street, Sydney NSW 2000"
 */
function formatShortAddress(row: SqliteRow, doc: OpenSearchDocument): string {
  const parts: string[] = [];

  // Building name
  if (doc.building_name) {
    parts.push(doc.building_name);
  }

  // Street number and street
  const streetParts: string[] = [];
  if (doc.street_number?.full) {
    streetParts.push(doc.street_number.full);
  }
  if (doc.street?.full) {
    streetParts.push(doc.street.full);
  }
  if (streetParts.length > 0) {
    parts.push(streetParts.join(' '));
  }

  // Postal delivery (alternative to street address)
  if (doc.postal_delivery?.full) {
    parts.push(doc.postal_delivery.full);
  }

  // Locality, state, postcode
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);

  return parts.join(', ');
}

/**
 * Generate search text for autocomplete
 * Concatenates all searchable fields into a single string
 */
function generateSearchText(row: SqliteRow, doc: OpenSearchDocument): string {
  const searchParts: string[] = [];

  // Add all address components
  if (doc.unit?.full) searchParts.push(doc.unit.full);
  if (doc.floor?.full) searchParts.push(doc.floor.full);
  if (doc.building_name) searchParts.push(doc.building_name);
  if (doc.street_number?.full) searchParts.push(doc.street_number.full);
  if (doc.street?.full) searchParts.push(doc.street.full);
  if (doc.postal_delivery?.full) searchParts.push(doc.postal_delivery.full);
  if (row.LOCALITY_NAME) searchParts.push(row.LOCALITY_NAME);
  if (row.STATE) searchParts.push(row.STATE);
  if (row.POSTCODE) searchParts.push(row.POSTCODE);

  // Add formatted addresses
  searchParts.push(doc.formatted_address);
  if (doc.formatted_address_short) {
    searchParts.push(doc.formatted_address_short);
  }

  return searchParts.join(' ');
}
