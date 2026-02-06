#!/usr/bin/env npx ts-node

/**
 * Fast PAF Export - Loads lookup tables into memory first
 * Much faster than doing JOINs in SQLite for each record
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG = {
  dbPath: path.join(__dirname, '..', 'apfdata.db'),
  outputDir: path.join(__dirname, '..', 'export'),
  indexName: 'paf-addresses',
  recordsPerFile: 500000,
};

interface Locality {
  id: number;
  name: string;
  postcode: string;
  state: string;
}

interface DeliveryPointGroup {
  id: number;
  streetName: string | null;
  streetType: string | null;
  streetSuffix: string | null;
  postalDeliveryType: string | null;
  localityId: number;
}

interface Building {
  deliveryPointId: number;
  buildingName: string | null;
}

async function main() {
  const startTime = Date.now();

  console.log('=== Fast PAF Export to NDJSON ===\n');

  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Open database
  console.log('Opening database...');
  const db = new Database(CONFIG.dbPath, { readonly: true });

  // Step 1: Load all localities into memory (small table)
  console.log('Loading localities...');
  const localities = new Map<number, Locality>();
  const localityRows = db.prepare('SELECT LOCALITY_ID, LOCALITY_NAME, POSTCODE, STATE FROM LOCALITY').all() as any[];
  for (const row of localityRows) {
    localities.set(row.LOCALITY_ID, {
      id: row.LOCALITY_ID,
      name: row.LOCALITY_NAME,
      postcode: row.POSTCODE,
      state: row.STATE,
    });
  }
  console.log(`  Loaded ${localities.size.toLocaleString()} localities`);

  // Step 2: Load all delivery point groups into memory
  console.log('Loading delivery point groups...');
  const groups = new Map<number, DeliveryPointGroup>();
  const groupRows = db.prepare(`
    SELECT DELIVY_POINT_GROUP_ID, STREET_NAME, STREET_TYPE, STREET_SFX,
           POSTAL_DELIVERY_TYPE, LOCALITY_ID
    FROM DELIVERY_POINT_GROUP
  `).all() as any[];
  for (const row of groupRows) {
    groups.set(row.DELIVY_POINT_GROUP_ID, {
      id: row.DELIVY_POINT_GROUP_ID,
      streetName: row.STREET_NAME,
      streetType: row.STREET_TYPE,
      streetSuffix: row.STREET_SFX,
      postalDeliveryType: row.POSTAL_DELIVERY_TYPE,
      localityId: row.LOCALITY_ID,
    });
  }
  console.log(`  Loaded ${groups.size.toLocaleString()} delivery point groups`);

  // Step 3: Load all buildings into memory
  console.log('Loading buildings...');
  const buildings = new Map<number, string>();
  const buildingRows = db.prepare(`
    SELECT DELIVY_POINT_ID, BLDG_PROP_NAME_1
    FROM BUILDING
    WHERE BLDG_PROP_NAME_1 IS NOT NULL
  `).all() as any[];
  for (const row of buildingRows) {
    buildings.set(row.DELIVY_POINT_ID, row.BLDG_PROP_NAME_1);
  }
  console.log(`  Loaded ${buildings.size.toLocaleString()} buildings`);

  const loadTime = (Date.now() - startTime) / 1000;
  console.log(`\nLookup tables loaded in ${loadTime.toFixed(1)}s`);

  // Step 4: Count delivery points
  const totalRecords = (db.prepare('SELECT COUNT(*) as total FROM DELIVERY_POINT').get() as any).total;
  console.log(`\nTotal delivery points: ${totalRecords.toLocaleString()}`);

  // Step 5: Stream delivery points and build documents
  console.log('\nExporting delivery points...');
  const exportStart = Date.now();

  // Simple query - no JOINs!
  const dpStmt = db.prepare(`
    SELECT DELIVY_POINT_ID, DELIVY_POINT_GROUP_ID,
           FLAT_UNIT_TYPE, FLAT_UNIT_NBR,
           FLOOR_LEVEL_TYPE, FLOOR_LEVEL_NBR,
           HOUSE_NBR_1, HOUSE_NBR_SFX_1, HOUSE_NBR_2, HOUSE_NBR_SFX_2,
           LOT_NBR,
           POSTAL_DELIVERY_NBR, POSTAL_DELIVERY_NBR_PFX, POSTAL_DELIVERY_NBR_SFX,
           PRIMARY_POINT_IND
    FROM DELIVERY_POINT
    ORDER BY DELIVY_POINT_ID
  `);

  let processedRecords = 0;
  let fileNumber = 0;
  let currentFileRecords = 0;
  let currentFileStream: fs.WriteStream | null = null;
  let currentFilePath = '';

  for (const dp of dpStmt.iterate() as Iterable<any>) {
    // Start new file if needed
    if (currentFileRecords === 0 || currentFileRecords >= CONFIG.recordsPerFile) {
      if (currentFileStream) {
        currentFileStream.end();
        console.log(`  Completed: ${path.basename(currentFilePath)} (${currentFileRecords.toLocaleString()} records)`);
      }

      fileNumber++;
      currentFilePath = path.join(CONFIG.outputDir, `paf-addresses-${String(fileNumber).padStart(4, '0')}.ndjson`);
      currentFileStream = fs.createWriteStream(currentFilePath);
      currentFileRecords = 0;
      console.log(`  Writing: ${path.basename(currentFilePath)}...`);
    }

    // Look up related data from memory
    const group = groups.get(dp.DELIVY_POINT_GROUP_ID);
    const locality = group ? localities.get(group.localityId) : null;
    const buildingName = buildings.get(dp.DELIVY_POINT_ID) || null;

    if (!group || !locality) {
      // Skip records with missing data
      continue;
    }

    // Build document
    const doc = buildDocument(dp, group, locality, buildingName);

    // Write bulk API format
    const actionLine = JSON.stringify({ index: { _index: CONFIG.indexName, _id: doc.delivery_point_id.toString() } });
    const docLine = JSON.stringify(doc);
    currentFileStream!.write(actionLine + '\n');
    currentFileStream!.write(docLine + '\n');

    processedRecords++;
    currentFileRecords++;

    // Progress update every 100k records
    if (processedRecords % 100000 === 0) {
      const elapsed = (Date.now() - exportStart) / 1000;
      const rate = Math.round(processedRecords / elapsed);
      const remaining = Math.round((totalRecords - processedRecords) / rate);
      const progressPercent = ((processedRecords / totalRecords) * 100).toFixed(1);
      console.log(`    Progress: ${processedRecords.toLocaleString()} (${progressPercent}%) - ${rate.toLocaleString()} rec/s - ETA: ${Math.floor(remaining / 60)}m ${remaining % 60}s`);
    }
  }

  // Close last file
  if (currentFileStream) {
    currentFileStream.end();
    console.log(`  Completed: ${path.basename(currentFilePath)} (${currentFileRecords.toLocaleString()} records)`);
  }

  db.close();

  const totalDuration = (Date.now() - startTime) / 1000;
  console.log('\n=== Export Complete ===');
  console.log(`Total records: ${processedRecords.toLocaleString()}`);
  console.log(`Total files: ${fileNumber}`);
  console.log(`Duration: ${Math.floor(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`);
  console.log(`Rate: ${Math.round(processedRecords / (totalDuration - loadTime)).toLocaleString()} records/second`);
  console.log(`\nOutput directory: ${CONFIG.outputDir}`);
  console.log(`\nNext: Run 'npx ts-node scripts/bulk-load-ndjson.ts' to load to OpenSearch`);
}

function buildDocument(dp: any, group: DeliveryPointGroup, locality: Locality, buildingName: string | null) {
  const unit = dp.FLAT_UNIT_TYPE || dp.FLAT_UNIT_NBR
    ? {
        type: dp.FLAT_UNIT_TYPE,
        number: dp.FLAT_UNIT_NBR,
        full: [dp.FLAT_UNIT_TYPE, dp.FLAT_UNIT_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  const floor = dp.FLOOR_LEVEL_TYPE || dp.FLOOR_LEVEL_NBR
    ? {
        type: dp.FLOOR_LEVEL_TYPE,
        number: dp.FLOOR_LEVEL_NBR,
        full: [dp.FLOOR_LEVEL_TYPE, dp.FLOOR_LEVEL_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  let streetNumberFull: string | null = null;
  if (dp.HOUSE_NBR_1) {
    streetNumberFull = `${dp.HOUSE_NBR_1}`;
    if (dp.HOUSE_NBR_SFX_1) streetNumberFull += dp.HOUSE_NBR_SFX_1;
    if (dp.HOUSE_NBR_2) {
      streetNumberFull += `-${dp.HOUSE_NBR_2}`;
      if (dp.HOUSE_NBR_SFX_2) streetNumberFull += dp.HOUSE_NBR_SFX_2;
    }
  }

  const streetNumber = dp.HOUSE_NBR_1
    ? {
        first: dp.HOUSE_NBR_1,
        first_suffix: dp.HOUSE_NBR_SFX_1,
        last: dp.HOUSE_NBR_2,
        last_suffix: dp.HOUSE_NBR_SFX_2,
        full: streetNumberFull,
      }
    : null;

  let postalDeliveryFull: string | null = null;
  if (group.postalDeliveryType || dp.POSTAL_DELIVERY_NBR) {
    const parts: string[] = [];
    if (group.postalDeliveryType) parts.push(group.postalDeliveryType);
    if (dp.POSTAL_DELIVERY_NBR_PFX) parts.push(dp.POSTAL_DELIVERY_NBR_PFX);
    if (dp.POSTAL_DELIVERY_NBR) parts.push(dp.POSTAL_DELIVERY_NBR.toString());
    if (dp.POSTAL_DELIVERY_NBR_SFX) parts.push(dp.POSTAL_DELIVERY_NBR_SFX);
    postalDeliveryFull = parts.join(' ') || null;
  }

  const postalDelivery = group.postalDeliveryType || dp.POSTAL_DELIVERY_NBR
    ? {
        type: group.postalDeliveryType,
        number: dp.POSTAL_DELIVERY_NBR,
        prefix: dp.POSTAL_DELIVERY_NBR_PFX,
        suffix: dp.POSTAL_DELIVERY_NBR_SFX,
        full: postalDeliveryFull,
      }
    : null;

  const streetFull = group.streetName
    ? [group.streetName, group.streetType, group.streetSuffix].filter(Boolean).join(' ')
    : null;

  const street = group.streetName
    ? {
        name: group.streetName,
        type: group.streetType,
        suffix: group.streetSuffix,
        full: streetFull,
      }
    : null;

  // Build formatted address
  const addressParts: string[] = [];
  if (unit?.full) addressParts.push(unit.full);
  if (floor?.full) addressParts.push(floor.full);
  if (buildingName) addressParts.push(buildingName);
  if (streetNumberFull) addressParts.push(streetNumberFull);
  if (streetFull) addressParts.push(streetFull);
  if (!streetFull && postalDeliveryFull) addressParts.push(postalDeliveryFull);
  addressParts.push(`${locality.name} ${locality.state} ${locality.postcode}`);

  const formattedAddress = addressParts.filter(Boolean).join(', ');

  // Build short address
  const shortParts: string[] = [];
  if (streetNumberFull && streetFull) {
    shortParts.push(`${streetNumberFull} ${streetFull}`);
  } else if (postalDeliveryFull) {
    shortParts.push(postalDeliveryFull);
  }
  shortParts.push(`${locality.name} ${locality.state} ${locality.postcode}`);
  const formattedAddressShort = shortParts.filter(Boolean).join(', ');

  // Build search text
  const searchParts: string[] = [];
  if (dp.FLAT_UNIT_TYPE) searchParts.push(dp.FLAT_UNIT_TYPE);
  if (dp.FLAT_UNIT_NBR) searchParts.push(dp.FLAT_UNIT_NBR);
  if (buildingName) searchParts.push(buildingName);
  if (streetNumberFull) searchParts.push(streetNumberFull);
  if (group.streetName) searchParts.push(group.streetName);
  if (group.streetType) searchParts.push(group.streetType);
  if (group.postalDeliveryType) searchParts.push(group.postalDeliveryType);
  if (dp.POSTAL_DELIVERY_NBR) searchParts.push(dp.POSTAL_DELIVERY_NBR.toString());
  searchParts.push(locality.name);
  searchParts.push(locality.state);
  searchParts.push(locality.postcode);

  return {
    delivery_point_id: dp.DELIVY_POINT_ID,
    delivery_point_group_id: dp.DELIVY_POINT_GROUP_ID,
    unit,
    floor,
    building_name: buildingName || null,
    street_number: streetNumber,
    lot_number: dp.LOT_NBR,
    postal_delivery: postalDelivery,
    street,
    locality: {
      id: locality.id,
      name: locality.name,
      postcode: locality.postcode,
      state: locality.state,
    },
    primary_point: dp.PRIMARY_POINT_IND === 'Y',
    formatted_address: formattedAddress,
    formatted_address_short: formattedAddressShort,
    search_text: searchParts.filter(Boolean).join(' '),
  };
}

main().catch(error => {
  console.error('Export failed:', error);
  process.exit(1);
});
