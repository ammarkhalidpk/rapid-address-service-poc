# PAF SQLite Database - Quick Reference Guide

## Database Overview

**File:** `apfdata.db`
**Size:** 1.6 GB
**Total Addresses:** 15,733,809 delivery points

## Table Summary

| Table | Records | Description |
|-------|---------|-------------|
| DELIVERY_POINT | 15.7M | Individual address delivery points |
| DELIVERY_POINT_GROUP | 516K | Street-level groupings |
| LOCALITY | 16K | Suburbs, towns, cities |
| BUILDING | 152K | Building/property names |
| CODE | 641 | Reference codes (types, abbreviations) |
| SYNONYM | 5K | Alternative locality names |
| STREET_ALT | 3.5K | Alternative street names |
| BORDERING_LOCALITY | 85K | Adjacent locality relationships |

## Core Tables

### DELIVERY_POINT (Main Address Records)

**Purpose:** Individual delivery points (addresses)

**Key Fields:**
- `DELIVY_POINT_ID` (PK) - Unique address identifier
- `DELIVY_POINT_GROUP_ID` (FK) - Links to street group
- `HOUSE_NBR_1`, `HOUSE_NBR_2` - Street numbers (range support)
- `HOUSE_NBR_SFX_1`, `HOUSE_NBR_SFX_2` - Number suffixes (A, B, etc.)
- `FLAT_UNIT_TYPE`, `FLAT_UNIT_NBR` - Unit information
- `FLOOR_LEVEL_TYPE`, `FLOOR_LEVEL_NBR` - Floor information
- `LOT_NBR` - Lot number
- `POSTAL_DELIVERY_NBR` - PO Box number
- `PRIMARY_POINT_IND` - Primary point flag (P/R/blank)

**Data Distribution:**
- 87% have street numbers
- 24% have units
- 0.5% have floors
- 13% are postal delivery (PO Box)

### DELIVERY_POINT_GROUP (Street Grouping)

**Purpose:** Groups addresses by street within locality

**Key Fields:**
- `DELIVY_POINT_GROUP_ID` (PK) - Unique group identifier
- `LOCALITY_ID` (FK) - Links to locality
- `STREET_NAME` - Street name
- `STREET_TYPE` - Street type abbreviation (ST, RD, AVE)
- `STREET_SFX` - Direction suffix (N, S, E, W)
- `POSTAL_DELIVERY_TYPE` - Postal type (PO BOX, GPO BOX)

**Data Distribution:**
- 98% have street type
- 0.4% have street suffix
- Average 30.5 delivery points per group

### LOCALITY (Suburbs/Towns)

**Purpose:** Suburb, town, and city information

**Key Fields:**
- `LOCALITY_ID` (PK) - Unique locality identifier
- `LOCALITY_NAME` - Suburb/town name
- `POSTCODE` - 4-digit postcode (with leading zeros)
- `STATE` - State abbreviation

**States:**
- ACT, NSW, NT, QLD, SA, TAS, VIC, WA

**Notes:**
- All fields 100% populated
- Some postcodes have multiple localities (max 97)

### BUILDING (Building Names)

**Purpose:** Building and property names

**Key Fields:**
- `DELIVY_POINT_ID` (FK) - Links to delivery point
- `BLDG_PROP_NAME_1` - Primary building name
- `BLDG_PROP_NAME_2` - Secondary building name (rare)

**Examples:**
- "TRINITY ARCADE"
- "WESTFIELD DONCASTER SHOPPING C" (truncated at 30 chars)
- "PARKSIDE FLATS"

**Notes:**
- Only 1% of addresses have building names

## Reference Tables

### CODE (Type Lookup)

**Purpose:** Lookup table for abbreviations and descriptions

**Type Categories:**

#### FLT (Floor/Level Types) - 17 codes
- B (Basement), G (Ground), L (Level), M (Mezzanine)
- LG (Lower Ground), UG (Upper Ground)

#### FUT (Flat/Unit Types) - 75 codes
Common: APT, U, SHOP, BLDG, TNHS, VLLA, OFF, SE, RM
Others: CTGE, DUP, FY, HSE, KSK, MB, MSNT, PTHS, REAR, SHED, SITE, SL, STU, WARD

#### PDT (Postal Delivery Types) - 72 codes
- PO BOX, GPO BOX, LOCKED BAG, PRIVATE BAG
- RMB (Roadside Mail Box), RMS, RSD
- MS (Mail Service), CMB, CMA, CPA

#### STA (State Abbreviations) - 31 codes
- ACT, NSW, NT, QLD, SA, TAS, VIC, WA
- AAT (Australian Antarctic Territory)

#### STS (Street Suffixes) - 26 codes
- N, S, E, W (North, South, East, West)
- NE, NW, SE, SW
- CN (Central), EX (Extension), LR (Lower), UP (Upper)

#### STT (Street Types) - 420 codes
**Top 20 Most Common:**
1. ST (Street) - 134,734 uses
2. RD (Road) - 132,573
3. CT (Court) - 47,431
4. AVE (Avenue) - 31,978
5. PL (Place) - 31,521
6. DR (Drive) - 24,283
7. LANE - 19,397
8. CL (Close) - 17,320
9. CRES (Crescent) - 15,184
10. WAY - 14,149
11. HWY (Highway) - 4,347
12. TCE (Terrace) - 4,099
13. CCT (Circuit) - 4,031
14. GR (Grove) - 3,535
15. PDE (Parade) - 3,534
16. BVD (Boulevard) - 1,960
17. RISE - 1,655
18. WALK - 1,272
19. LOOP - 1,041
20. (blank) - 12,037

### SYNONYM (Alternative Locality Names)

**Purpose:** Alternative names for localities

**Examples:**
- "BANDON" → "PAYTENS BRIDGE" (NSW 2871)
- "SAINT CLAIR" / "ST CLARE" → "ST CLAIR" (SA 5011)
- "CROWDY BAY NATIONAL PARK" → "CROWDY BAY" (NSW 2443)

**Use Case:** Enable search by alternative locality names

### STREET_ALT (Alternative Street Names)

**Purpose:** Alternative or historical street names

**Examples:**
- "CONNOLLY ST" alternate: "BROOKS RD" (Sarina)
- "NORTH YUNDERUP RD" alternate: "YUNDERUP RD" (North Yunderup)

**Use Case:** Search by old/alternative street names

### BORDERING_LOCALITY (Adjacent Localities)

**Purpose:** Neighboring locality relationships

**Records:** 84,854 border relationships
**Parent Localities:** 14,933 unique

**Use Case:** "Did you mean" suggestions for wrong suburb

## Join Relationships

### Complete Address Construction Query

```sql
SELECT
  -- Building
  b.BLDG_PROP_NAME_1,

  -- Unit
  dp.FLAT_UNIT_TYPE || ' ' || dp.FLAT_UNIT_NBR as unit,

  -- Floor
  dp.FLOOR_LEVEL_TYPE || ' ' || dp.FLOOR_LEVEL_NBR as floor,

  -- Street Number
  CAST(dp.HOUSE_NBR_1 AS TEXT) || COALESCE(dp.HOUSE_NBR_SFX_1, '') ||
  CASE WHEN dp.HOUSE_NBR_2 > 0
    THEN '-' || CAST(dp.HOUSE_NBR_2 AS TEXT) || COALESCE(dp.HOUSE_NBR_SFX_2, '')
    ELSE ''
  END as street_number,

  -- Street
  dpg.STREET_NAME || ' ' || COALESCE(dpg.STREET_TYPE, '') ||
  COALESCE(' ' || dpg.STREET_SFX, '') as street,

  -- Postal Delivery
  CASE WHEN dpg.POSTAL_DELIVERY_TYPE IS NOT NULL
    THEN dpg.POSTAL_DELIVERY_TYPE || ' ' || CAST(dp.POSTAL_DELIVERY_NBR AS TEXT)
    ELSE NULL
  END as postal_delivery,

  -- Locality
  l.LOCALITY_NAME,
  l.STATE,
  l.POSTCODE

FROM DELIVERY_POINT dp
JOIN DELIVERY_POINT_GROUP dpg ON dp.DELIVY_POINT_GROUP_ID = dpg.DELIVY_POINT_GROUP_ID
JOIN LOCALITY l ON dpg.LOCALITY_ID = l.LOCALITY_ID
LEFT JOIN BUILDING b ON dp.DELIVY_POINT_ID = b.DELIVY_POINT_ID
```

## Address Format Examples

### Simple Street Address
```
171 LACHLAN ST, FORBES NSW 2871
```

### Unit Address
```
U 505 1 BRIGHTWELL LANE, ERSKINEVILLE NSW 2043
```

### Complex Address (Building + Floor + Shop)
```
SHOP 45 L 2 TRINITY ARCADE 671 HAY ST, PERTH WA 6000
```

### Street Number Range
```
80-100 RAILWAY AVE, PARKSIDE QLD 4825
```

### PO Box
```
PO BOX 470, WAIKERIE SA 5330
```

### Street Number with Suffix
```
1A ANZAC AVE, COBURG NORTH VIC 3058
```

## Data Quality Notes

### NULL/Empty Values

**DELIVERY_POINT:**
- 76% have no unit
- 99.5% have no floor
- 13% have no street number (mostly PO Box)
- 99.5% have no lot number

**DELIVERY_POINT_GROUP:**
- 1.8% have no street name (postal delivery)
- 2.3% have no street type
- 99.6% have no street suffix
- 98.2% have no postal delivery type

**LOCALITY:**
- All fields 100% populated

### Data Patterns

**Street Numbers:**
- Range: 0 to thousands
- Suffixes: A, B, C, etc.
- Ranges: 80-100, 1-5, etc.

**Unit Numbers:**
- Alphanumeric: 1, 505, 1113, 45, 23T
- Can be letters: A, B, etc.

**Floor Numbers:**
- Numeric: 1, 2, 6
- Letters: B (basement), G (ground)
- Alphanumeric: 2A, G1

**Postcodes:**
- 4-digit strings
- Leading zeros preserved (0872, 0822)

**Building Names:**
- Often truncated at 30 characters
- Example: "WESTFIELD DONCASTER SHOPPING C"

## Primary Keys and Indexes

### DELIVERY_POINT
- PK: `DELIVY_POINT_ID`
- Indexes:
  - `DELIVY_POINT_GROUP_ID`
  - `HOUSE_NBR_1, HOUSE_NBR_2`
  - Composite: `(DELIVY_POINT_GROUP_ID, HOUSE_NBR_1, HOUSE_NBR_2, FLOOR_LEVEL_TYPE, FLOOR_LEVEL_NBR, FLAT_UNIT_NBR)`
  - Postal: `(DELIVY_POINT_GROUP_ID, POSTAL_DELIVERY_NBR)`

### DELIVERY_POINT_GROUP
- PK: `DELIVY_POINT_GROUP_ID`
- Indexes:
  - `LOCALITY_ID`
  - Composite: `(LOCALITY_ID, STREET_NAME)`

### LOCALITY
- PK: `LOCALITY_ID`
- Indexes:
  - Composite: `(LOCALITY_NAME, POSTCODE, STATE)`

### BUILDING
- No primary key
- No indexes

### STREET_ALT
- Indexes:
  - `DELIVY_POINT_GROUP_ID`

### BORDERING_LOCALITY
- Indexes:
  - `PARENT_LOCALITY_ID`

## Query Performance Tips

1. **Always join on indexed columns**
   - Use DELIVY_POINT_GROUP_ID for joining DELIVERY_POINT to DELIVERY_POINT_GROUP
   - Use LOCALITY_ID for joining DELIVERY_POINT_GROUP to LOCALITY

2. **Filter early**
   - Apply WHERE clauses on LOCALITY first (smallest table)
   - Use postcode/state filters to reduce result set

3. **Use LIMIT for testing**
   - Always use LIMIT when testing queries (15.7M rows is large)

4. **Batch processing**
   - Process in batches of 10,000-50,000 for ETL operations
   - Use OFFSET and LIMIT for pagination

## Useful Queries

### Count by State
```sql
SELECT STATE, COUNT(*) as count
FROM LOCALITY
GROUP BY STATE
ORDER BY count DESC;
```

### Top 20 Street Names
```sql
SELECT STREET_NAME, COUNT(*) as count
FROM DELIVERY_POINT_GROUP
WHERE STREET_NAME IS NOT NULL
GROUP BY STREET_NAME
ORDER BY count DESC
LIMIT 20;
```

### Addresses with Buildings
```sql
SELECT
  b.BLDG_PROP_NAME_1,
  COUNT(*) as address_count
FROM BUILDING b
GROUP BY b.BLDG_PROP_NAME_1
ORDER BY address_count DESC
LIMIT 20;
```

### Localities with Most Addresses
```sql
SELECT
  l.LOCALITY_NAME,
  l.STATE,
  l.POSTCODE,
  COUNT(dp.DELIVY_POINT_ID) as address_count
FROM LOCALITY l
JOIN DELIVERY_POINT_GROUP dpg ON l.LOCALITY_ID = dpg.LOCALITY_ID
JOIN DELIVERY_POINT dp ON dpg.DELIVY_POINT_GROUP_ID = dp.DELIVY_POINT_GROUP_ID
GROUP BY l.LOCALITY_ID, l.LOCALITY_NAME, l.STATE, l.POSTCODE
ORDER BY address_count DESC
LIMIT 20;
```

---

**Last Updated:** 2026-02-05
**Database Version:** PAF Australian Address Data
