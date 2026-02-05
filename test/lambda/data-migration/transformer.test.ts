/**
 * Unit tests for document transformer
 */

import { transformToDocument } from '../../../lambda/data-migration/transformer';
import { SqliteRow, OpenSearchDocument } from '../../../lambda/data-migration/types';

describe('transformToDocument', () => {
  it('should transform a complete SQLite row to OpenSearch document', () => {
    const row: SqliteRow = {
      DELIVY_POINT_ID: 12345,
      DELIVY_POINT_GROUP_ID: 67890,
      FLAT_UNIT_TYPE: 'UNIT',
      FLAT_UNIT_NBR: '5',
      FLOOR_LEVEL_TYPE: 'LEVEL',
      FLOOR_LEVEL_NBR: '2',
      HOUSE_NBR_1: 123,
      HOUSE_NBR_SFX_1: 'A',
      HOUSE_NBR_2: null,
      HOUSE_NBR_SFX_2: null,
      LOT_NBR: null,
      POSTAL_DELIVERY_NBR: null,
      POSTAL_DELIVERY_NBR_PFX: null,
      POSTAL_DELIVERY_NBR_SFX: null,
      PRIMARY_POINT_IND: 'Y',
      STREET_NAME: 'GEORGE',
      STREET_TYPE: 'STREET',
      STREET_SFX: null,
      POSTAL_DELIVERY_TYPE: null,
      LOCALITY_ID: 111,
      LOCALITY_NAME: 'SYDNEY',
      POSTCODE: '2000',
      STATE: 'NSW',
      BLDG_PROP_NAME_1: 'ENTERPRISE BUILDING',
    };

    const doc = transformToDocument(row);

    expect(doc.delivery_point_id).toBe(12345);
    expect(doc.delivery_point_group_id).toBe(67890);
    expect(doc.locality_id).toBe(111);
    expect(doc.unit?.type).toBe('UNIT');
    expect(doc.unit?.number).toBe('5');
    expect(doc.unit?.full).toBe('UNIT 5');
    expect(doc.floor?.type).toBe('LEVEL');
    expect(doc.floor?.number).toBe('2');
    expect(doc.floor?.full).toBe('LEVEL 2');
    expect(doc.building_name).toBe('ENTERPRISE BUILDING');
    expect(doc.street_number?.number_1).toBe(123);
    expect(doc.street_number?.suffix_1).toBe('A');
    expect(doc.street_number?.full).toBe('123A');
    expect(doc.street?.name).toBe('GEORGE');
    expect(doc.street?.type).toBe('STREET');
    expect(doc.street?.full).toBe('GEORGE STREET');
    expect(doc.locality.name).toBe('SYDNEY');
    expect(doc.locality.postcode).toBe('2000');
    expect(doc.locality.state).toBe('NSW');
    expect(doc.primary_point_indicator).toBe('Y');
    expect(doc.formatted_address).toContain('UNIT 5');
    expect(doc.formatted_address).toContain('LEVEL 2');
    expect(doc.formatted_address).toContain('123A GEORGE STREET');
    expect(doc.formatted_address).toContain('SYDNEY NSW 2000');
    expect(doc.search_text).toContain('GEORGE STREET');
    expect(doc.search_text).toContain('SYDNEY');
  });

  it('should handle minimal address data', () => {
    const row: SqliteRow = {
      DELIVY_POINT_ID: 99999,
      DELIVY_POINT_GROUP_ID: 88888,
      FLAT_UNIT_TYPE: null,
      FLAT_UNIT_NBR: null,
      FLOOR_LEVEL_TYPE: null,
      FLOOR_LEVEL_NBR: null,
      HOUSE_NBR_1: 42,
      HOUSE_NBR_SFX_1: null,
      HOUSE_NBR_2: null,
      HOUSE_NBR_SFX_2: null,
      LOT_NBR: null,
      POSTAL_DELIVERY_NBR: null,
      POSTAL_DELIVERY_NBR_PFX: null,
      POSTAL_DELIVERY_NBR_SFX: null,
      PRIMARY_POINT_IND: null,
      STREET_NAME: 'MAIN',
      STREET_TYPE: 'ROAD',
      STREET_SFX: null,
      POSTAL_DELIVERY_TYPE: null,
      LOCALITY_ID: 222,
      LOCALITY_NAME: 'MELBOURNE',
      POSTCODE: '3000',
      STATE: 'VIC',
      BLDG_PROP_NAME_1: null,
    };

    const doc = transformToDocument(row);

    expect(doc.delivery_point_id).toBe(99999);
    expect(doc.unit).toBeUndefined();
    expect(doc.floor).toBeUndefined();
    expect(doc.building_name).toBeUndefined();
    expect(doc.street_number?.number_1).toBe(42);
    expect(doc.street_number?.full).toBe('42');
    expect(doc.street?.full).toBe('MAIN ROAD');
    expect(doc.locality.name).toBe('MELBOURNE');
    expect(doc.formatted_address).toBe('42 MAIN ROAD, MELBOURNE VIC 3000');
  });

  it('should handle street number ranges', () => {
    const row: SqliteRow = {
      DELIVY_POINT_ID: 11111,
      DELIVY_POINT_GROUP_ID: 22222,
      FLAT_UNIT_TYPE: null,
      FLAT_UNIT_NBR: null,
      FLOOR_LEVEL_TYPE: null,
      FLOOR_LEVEL_NBR: null,
      HOUSE_NBR_1: 10,
      HOUSE_NBR_SFX_1: 'A',
      HOUSE_NBR_2: 12,
      HOUSE_NBR_SFX_2: 'B',
      LOT_NBR: null,
      POSTAL_DELIVERY_NBR: null,
      POSTAL_DELIVERY_NBR_PFX: null,
      POSTAL_DELIVERY_NBR_SFX: null,
      PRIMARY_POINT_IND: null,
      STREET_NAME: 'HIGH',
      STREET_TYPE: 'STREET',
      STREET_SFX: null,
      POSTAL_DELIVERY_TYPE: null,
      LOCALITY_ID: 333,
      LOCALITY_NAME: 'BRISBANE',
      POSTCODE: '4000',
      STATE: 'QLD',
      BLDG_PROP_NAME_1: null,
    };

    const doc = transformToDocument(row);

    expect(doc.street_number?.number_1).toBe(10);
    expect(doc.street_number?.suffix_1).toBe('A');
    expect(doc.street_number?.number_2).toBe(12);
    expect(doc.street_number?.suffix_2).toBe('B');
    expect(doc.street_number?.full).toBe('10A-12B');
    expect(doc.formatted_address).toContain('10A-12B HIGH STREET');
  });

  it('should handle postal delivery addresses', () => {
    const row: SqliteRow = {
      DELIVY_POINT_ID: 55555,
      DELIVY_POINT_GROUP_ID: 66666,
      FLAT_UNIT_TYPE: null,
      FLAT_UNIT_NBR: null,
      FLOOR_LEVEL_TYPE: null,
      FLOOR_LEVEL_NBR: null,
      HOUSE_NBR_1: null,
      HOUSE_NBR_SFX_1: null,
      HOUSE_NBR_2: null,
      HOUSE_NBR_SFX_2: null,
      LOT_NBR: null,
      POSTAL_DELIVERY_NBR: 123,
      POSTAL_DELIVERY_NBR_PFX: null,
      POSTAL_DELIVERY_NBR_SFX: null,
      PRIMARY_POINT_IND: null,
      STREET_NAME: null,
      STREET_TYPE: null,
      STREET_SFX: null,
      POSTAL_DELIVERY_TYPE: 'PO BOX',
      LOCALITY_ID: 444,
      LOCALITY_NAME: 'PERTH',
      POSTCODE: '6000',
      STATE: 'WA',
      BLDG_PROP_NAME_1: null,
    };

    const doc = transformToDocument(row);

    expect(doc.postal_delivery?.type).toBe('PO BOX');
    expect(doc.postal_delivery?.number).toBe(123);
    expect(doc.postal_delivery?.full).toBe('PO BOX 123');
    expect(doc.formatted_address).toBe('PO BOX 123, PERTH WA 6000');
    expect(doc.search_text).toContain('PO BOX 123');
  });

  it('should generate proper search text', () => {
    const row: SqliteRow = {
      DELIVY_POINT_ID: 77777,
      DELIVY_POINT_GROUP_ID: 88888,
      FLAT_UNIT_TYPE: 'APT',
      FLAT_UNIT_NBR: '10',
      FLOOR_LEVEL_TYPE: null,
      FLOOR_LEVEL_NBR: null,
      HOUSE_NBR_1: 50,
      HOUSE_NBR_SFX_1: null,
      HOUSE_NBR_2: null,
      HOUSE_NBR_SFX_2: null,
      LOT_NBR: null,
      POSTAL_DELIVERY_NBR: null,
      POSTAL_DELIVERY_NBR_PFX: null,
      POSTAL_DELIVERY_NBR_SFX: null,
      PRIMARY_POINT_IND: null,
      STREET_NAME: 'ELIZABETH',
      STREET_TYPE: 'STREET',
      STREET_SFX: null,
      POSTAL_DELIVERY_TYPE: null,
      LOCALITY_ID: 555,
      LOCALITY_NAME: 'ADELAIDE',
      POSTCODE: '5000',
      STATE: 'SA',
      BLDG_PROP_NAME_1: 'THE TOWER',
    };

    const doc = transformToDocument(row);

    expect(doc.search_text).toContain('APT 10');
    expect(doc.search_text).toContain('THE TOWER');
    expect(doc.search_text).toContain('50');
    expect(doc.search_text).toContain('ELIZABETH STREET');
    expect(doc.search_text).toContain('ADELAIDE');
    expect(doc.search_text).toContain('SA');
    expect(doc.search_text).toContain('5000');
  });
});
