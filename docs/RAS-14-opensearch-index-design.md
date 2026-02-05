# Technical Design: PAF SQLite Analysis and OpenSearch Index Mapping

## Executive Summary

This document provides a comprehensive analysis of the Australian Postcode Address File (PAF) SQLite database (1.6 GB, 15.7M address records) and designs a denormalized OpenSearch index optimized for fast autocomplete functionality. The design includes edge n-gram analyzers for partial matching, multi-field mappings for flexible search, and a complete address construction strategy.

## Project Context

- **Project:** Rapid Address Service POC (RAS-14)
- **Objective:** Migrate PAF data from SQLite to OpenSearch for high-performance address autocomplete
- **Database:** Australian PAF data (apfdata.db, 1.6 GB)
- **Records:** 15.7M delivery points, 516K street groups, 16K localities
- **Tech Stack:** AWS OpenSearch, Lambda (Node.js 20.x), SQLite (source)
- **Timeline:** Schema analysis and index design phase
- **Scale:** 15.7M address documents, autocomplete queries < 100ms response time
- **Constraints:** Read-heavy workload, denormalized index for performance, Australian address formats

## Requirements & Assumptions

### Requirements

1. Fast autocomplete search across all address components (street, suburb, postcode, building)
2. Support partial matching from start of words (edge n-gram)
3. Handle Australian address formats with unit, floor, building, street, locality components
4. Preserve all PAF data fields for complete address construction
5. Support search by street name, locality, postcode, building name
6. Return formatted addresses matching Australian postal standards

### Assumptions

- Read-heavy workload (autocomplete queries), infrequent updates (PAF data changes)
- Users typically search by typing street name, suburb, or postcode
- Autocomplete requires partial matching from the start of words (e.g., "123 Geo" matches "123 George Street")
- Denormalized index structure is acceptable (data duplication for performance)
- OpenSearch cluster will have sufficient memory for edge n-gram token filters
- Australian address format follows: [UNIT] [FLOOR] [BUILDING] [STREET_NUMBER] [STREET_NAME] [STREET_TYPE] [SUBURB] [STATE] [POSTCODE]

### Non-Goals (Out of Scope)

- Geocoding and coordinate-based search (AWS Location Service handles this separately)
- Address validation and correction
- Real-time PAF data updates (batch import strategy)
- Multi-country address support (Australian PAF only)

## SQLite Database Analysis

### Database Overview

**File:** `/Users/ammarkhalid/workspace/rapid-address-service-poc/apfdata.db`
**Size:** 1.6 GB
**RDBMS:** SQLite 3
**Record Counts:**
- DELIVERY_POINT: 15,733,809 records
- DELIVERY_POINT_GROUP: 516,479 records (street-level grouping)
- LOCALITY: 15,794 records (suburbs/towns)
- BUILDING: 152,532 records (building/property names)
- CODE: 641 records (reference codes for types)
- SYNONYM: ~5,000 records (locality synonyms)
- STREET_ALT: ~3,500 records (alternative street names)
- BORDERING_LOCALITY: 84,854 records (adjacent localities)

### Table Schemas

#### 1. DELIVERY_POINT (Main Address Records)

Primary entity representing individual delivery points (addresses).

```sql
CREATE TABLE DELIVERY_POINT(
  RECORD_ACTN_CODE TEXT,           -- Action code (I=Insert, U=Update, D=Delete)
  DELIVY_POINT_ID INTEGER PRIMARY KEY,  -- Unique delivery point ID
  DELIVY_POINT_GROUP_ID INTEGER,   -- Foreign key to street group
  HOUSE_NBR_1 INTEGER,             -- Primary street number
  HOUSE_NBR_SFX_1 TEXT,            -- Street number suffix (e.g., 'A', 'B')
  HOUSE_NBR_2 INTEGER,             -- Secondary street number (for ranges)
  HOUSE_NBR_SFX_2 TEXT,            -- Secondary street number suffix
  FLAT_UNIT_TYPE TEXT,             -- Unit type code (U, APT, SHOP, etc.)
  FLAT_UNIT_NBR TEXT,              -- Unit number (alphanumeric)
  FLOOR_LEVEL_TYPE TEXT,           -- Floor type code (L, G, B, etc.)
  FLOOR_LEVEL_NBR TEXT,            -- Floor number (alphanumeric)
  LOT_NBR TEXT,                    -- Lot number
  POSTAL_DELIVERY_NBR INTEGER,     -- PO Box number
  POSTAL_DELIVERY_NBR_PFX TEXT,    -- PO Box prefix
  POSTAL_DELIVERY_NBR_SFX TEXT,    -- PO Box suffix
  PRIMARY_POINT_IND TEXT           -- Primary point indicator (P/R/blank)
);
```

**Indexes:**
- Primary key on DELIVY_POINT_ID
- Index on DELIVY_POINT_GROUP_ID (join optimization)
- Composite index on house numbers
- Composite index on unit/floor/house for complex addresses

**Data Distribution:**
- Total records: 15,733,809
- Records with street numbers: 13,654,537 (87%)
- Records with units: 3,752,767 (24%)
- Records with floors: 80,361 (0.5%)
- Records with lot numbers: 73,418 (0.5%)
- Postal delivery (PO Box): ~2M records (13%)

**PRIMARY_POINT_IND Values:**
- P (Primary): 205,178 records
- R (Range/Secondary): 9,110,017 records
- Blank: 6,418,614 records

#### 2. DELIVERY_POINT_GROUP (Street-Level Grouping)

Groups delivery points by street within a locality.

```sql
CREATE TABLE DELIVERY_POINT_GROUP(
  RECORD_ACTN_CODE TEXT,
  DELIVY_POINT_GROUP_ID INTEGER PRIMARY KEY,
  LOCALITY_ID INTEGER,             -- Foreign key to locality
  STREET_NAME TEXT,                -- Street name
  STREET_TYPE TEXT,                -- Street type abbreviation (ST, RD, AVE, etc.)
  STREET_SFX TEXT,                 -- Street suffix (N, S, E, W, etc.)
  POSTAL_DELIVERY_TYPE TEXT,       -- Postal type (PO BOX, GPO BOX, etc.)
  DELIVY_POINT_GROUP_DID INTEGER   -- Alternative ID
);
```

**Indexes:**
- Primary key on DELIVY_POINT_GROUP_ID
- Index on LOCALITY_ID
- Composite index on (LOCALITY_ID, STREET_NAME)

**Data Distribution:**
- Total groups: 516,479
- Groups with street type: 504,442 (98%)
- Groups with street suffix: 2,298 (0.4%)
- Groups with postal delivery type: 9,529 (1.8%)
- Unique localities: 15,794

**Relationship:** Average 30.5 delivery points per street group (15.7M / 516K)

#### 3. LOCALITY (Suburbs/Towns)

Contains suburb, town, and city information.

```sql
CREATE TABLE LOCALITY(
  RECORD_ACTN_CODE TEXT,
  LOCALITY_ID INTEGER PRIMARY KEY,
  LOCALITY_NAME TEXT,              -- Suburb/town name
  POSTCODE TEXT,                   -- 4-digit postcode
  STATE TEXT,                      -- State abbreviation
  LOCALITY_DID INTEGER             -- Alternative ID
);
```

**Indexes:**
- Primary key on LOCALITY_ID
- Composite index on (LOCALITY_NAME, POSTCODE, STATE)

**Data Distribution:**
- Total localities: 15,794
- All records have LOCALITY_NAME (100%)
- All records have POSTCODE (100%)
- All records have STATE (100%)

**States:**
- NSW (New South Wales)
- VIC (Victoria)
- QLD (Queensland)
- WA (Western Australia)
- SA (South Australia)
- TAS (Tasmania)
- ACT (Australian Capital Territory)
- NT (Northern Territory)

**Postcode Characteristics:**
- Most postcodes have 1 locality
- Some postcodes have multiple localities (max observed: 97 localities for postcode 0822)
- Postcodes are 4 digits (some have leading zeros, e.g., 0872)

#### 4. BUILDING (Building/Property Names)

Contains building and property names for delivery points.

```sql
CREATE TABLE BUILDING(
  RECORD_ACTN_CODE TEXT,
  DELIVY_POINT_ID INTEGER,         -- Foreign key to delivery point
  BLDG_PROP_NAME_1 TEXT,           -- Primary building name
  BLDG_PROP_NAME_2 TEXT            -- Secondary building name
);
```

**No indexes** (relatively small table)

**Data Distribution:**
- Total records: 152,532
- Unique delivery points: 151,999 (some points have multiple building names)
- Records with BLDG_PROP_NAME_1: 152,532 (100%)
- Records with BLDG_PROP_NAME_2: Very few

**Building Name Examples:**
- "PALMWOODS GARDEN VILLAGE"
- "TRINITY ARCADE"
- "WESTFIELD DONCASTER SHOPPING C"
- "QUARTER DECK"
- "ST JOHN BOSCO PRIMARY SCHOOL"

**Relationship:** Only 0.97% of delivery points have building names (152K / 15.7M)

#### 5. CODE (Reference Data for Type Codes)

Lookup table for type abbreviations and descriptions.

```sql
CREATE TABLE CODE(
  RECORD_ACTN_CODE TEXT,
  TYPE_ID TEXT,                    -- Type category
  TYPE_ITEM TEXT,                  -- Full description
  TYPE_ITEM_ABBR TEXT,             -- Abbreviation used in data
  TYPE_ACTN_CODE TEXT              -- Action code
);
```

**Type Categories (TYPE_ID):**

1. **FLT (Floor/Level Types)** - 17 codes
   - B (Basement), G (Ground), L (Level), M (Mezzanine), UG (Upper Ground), LG (Lower Ground)

2. **FUT (Flat/Unit Types)** - 75 codes
   - APT (Apartment), U (Unit), SHOP (Shop), BLDG (Building), TNHS (Townhouse)
   - VLLA (Villa), OFF (Office), SE (Suite), RM (Room), SITE (Site)
   - CTGE (Cottage), DUP (Duplex), FY (Factory), HSE (House), KSK (Kiosk)
   - MB (Mailbox), MSNT (Maisonette), PTHS (Penthouse), REAR (Rear), SHED, SL (Stall)
   - STU (Studio), WARD (Ward)

3. **PDT (Postal Delivery Types)** - 72 codes
   - PO BOX, GPO BOX, LOCKED BAG, PRIVATE BAG, RMB (Roadside Mail Box)
   - RMS (Roadside Mail Service), RSD (Roadside Delivery), MS (Mail Service)
   - CMB (Community Mail Bag), CMA/CPA (Community Postal Agent)
   - CARE PO (Care of PO)

4. **STA (State Abbreviations)** - 31 codes
   - ACT, NSW, NT, QLD, SA, TAS, VIC, WA
   - AAT (Australian Antarctic Territory)

5. **STS (Street Suffixes)** - 26 codes
   - N (North), S (South), E (East), W (West)
   - NE (North East), NW (North West), SE (South East), SW (South West)
   - CN (Central), EX (Extension), LR (Lower), UP (Upper)

6. **STT (Street Types)** - 420 codes
   - Most common: ST (Street), RD (Road), AVE (Avenue), CT (Court), PL (Place), DR (Drive)
   - Other: LANE, CL (Close), CRES (Crescent), WAY, HWY (Highway), TCE (Terrace)
   - Less common: CCT (Circuit), GR (Grove), PDE (Parade), BVD (Boulevard)
   - Specialized: LOOP, RISE, WALK, LINK, MEWS, PIAZ (Piazza), QDRT (Quadrant)

**Top 20 Street Types (by usage):**
1. ST (Street) - 134,734 occurrences
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

#### 6. SYNONYM (Locality Name Alternatives)

Alternative names for localities.

```sql
CREATE TABLE SYNONYM(
  RECORD_ACTN_CODE TEXT,
  TYPE_ID TEXT,                    -- Always 'LOC' for locality
  LOCALITY_ID INTEGER,             -- Foreign key to locality
  SYNONYM TEXT,                    -- Alternative locality name
  POSTCODE TEXT,                   -- Associated postcode
  TYPE_ACTN_CODE TEXT
);
```

**Examples:**
- "BANDON" → "PAYTENS BRIDGE" (NSW 2871)
- "SAINT CLAIR" / "ST CLARE" → "ST CLAIR" (SA 5011)
- "CROWDY BAY NATIONAL PARK" → "CROWDY BAY" (NSW 2443)

**Usage:** Enable search by alternative locality names (e.g., searching "Saint Clair" finds "St Clair" addresses)

#### 7. STREET_ALT (Alternative Street Names)

Alternative or historical street names.

```sql
CREATE TABLE STREET_ALT(
  RECORD_ACTN_CODE TEXT,
  DELIVY_POINT_GROUP_ID INTEGER,   -- Foreign key to street group
  ST_ALT_STREET_NAME TEXT,         -- Alternative street name
  ST_ALT_STREET_TYPE TEXT,         -- Alternative street type
  ST_ALT_STREET_SFX TEXT           -- Alternative street suffix
);
```

**Indexes:**
- Index on DELIVY_POINT_GROUP_ID

**Examples:**
- "CONNOLLY ST" alternate: "BROOKS RD" (Sarina)
- "NORTH YUNDERUP RD" alternate: "YUNDERUP RD" (North Yunderup)
- "L. L. RD" alternate: "LL RD" (Officer)

**Usage:** Enable search by old or alternative street names (e.g., street was renamed)

#### 8. BORDERING_LOCALITY (Adjacent Localities)

Defines relationships between neighboring localities.

```sql
CREATE TABLE BORDERING_LOCALITY(
  RECORD_ACTN_CODE TEXT,
  PARENT_LOCALITY_ID INTEGER,      -- Primary locality
  BORDERING_LOCALITY_ID INTEGER,   -- Bordering locality ID
  BORDERING_LOCALITY_NAME TEXT,    -- Bordering locality name
  BORDERING_POSTCODE TEXT          -- Bordering locality postcode
);
```

**Indexes:**
- Index on PARENT_LOCALITY_ID

**Data Distribution:**
- Total records: 84,854
- Unique parent localities: 14,933

**Usage:** Potentially useful for "did you mean" suggestions when user searches wrong suburb

### Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CORE DATA MODEL                         │
└─────────────────────────────────────────────────────────────────┘

                        LOCALITY (16K)
                        ┌──────────────────┐
                        │ LOCALITY_ID (PK) │
                        │ LOCALITY_NAME    │
                        │ POSTCODE         │
                        │ STATE            │
                        └────────┬─────────┘
                                 │ 1
                                 │
                                 │ N
                  DELIVERY_POINT_GROUP (516K)
                  ┌───────────────────────────┐
                  │ DELIVY_POINT_GROUP_ID(PK) │
                  │ LOCALITY_ID (FK)          │
                  │ STREET_NAME               │
                  │ STREET_TYPE               │
                  │ STREET_SFX                │
                  │ POSTAL_DELIVERY_TYPE      │
                  └───────────┬───────────────┘
                              │ 1
                              │
                              │ N (~30.5 avg)
           DELIVERY_POINT (15.7M)
           ┌────────────────────────────┐
           │ DELIVY_POINT_ID (PK)       │
           │ DELIVY_POINT_GROUP_ID (FK) │
           │ HOUSE_NBR_1, HOUSE_NBR_2   │
           │ HOUSE_NBR_SFX_1, SFX_2     │
           │ FLAT_UNIT_TYPE, NBR        │
           │ FLOOR_LEVEL_TYPE, NBR      │
           │ LOT_NBR                    │
           │ POSTAL_DELIVERY_NBR        │
           │ PRIMARY_POINT_IND          │
           └───────────┬────────────────┘
                       │ 1
                       │
                       │ 0..1 (0.97%)
              BUILDING (152K)
              ┌─────────────────────┐
              │ DELIVY_POINT_ID(FK) │
              │ BLDG_PROP_NAME_1    │
              │ BLDG_PROP_NAME_2    │
              └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      SUPPORTING TABLES                          │
└─────────────────────────────────────────────────────────────────┘

     SYNONYM (~5K)                  STREET_ALT (~3.5K)
     ┌──────────────────┐           ┌─────────────────────────┐
     │ LOCALITY_ID (FK) │           │ DELIVY_POINT_GROUP_ID   │
     │ SYNONYM          │           │ ST_ALT_STREET_NAME      │
     │ POSTCODE         │           │ ST_ALT_STREET_TYPE      │
     └──────────────────┘           └─────────────────────────┘

     BORDERING_LOCALITY (85K)       CODE (641)
     ┌─────────────────────────┐    ┌──────────────────┐
     │ PARENT_LOCALITY_ID (FK) │    │ TYPE_ID          │
     │ BORDERING_LOCALITY_ID   │    │ TYPE_ITEM        │
     │ BORDERING_LOCALITY_NAME │    │ TYPE_ITEM_ABBR   │
     │ BORDERING_POSTCODE      │    │ TYPE_ACTN_CODE   │
     └─────────────────────────┘    └──────────────────┘
```

### Join Relationships and Address Construction

To construct a complete address, the following joins are required:

```sql
SELECT
  -- Building/Property
  b.BLDG_PROP_NAME_1,

  -- Unit/Flat
  dp.FLAT_UNIT_TYPE || ' ' || dp.FLAT_UNIT_NBR,

  -- Floor/Level
  dp.FLOOR_LEVEL_TYPE || ' ' || dp.FLOOR_LEVEL_NBR,

  -- Street Number (with range support)
  CAST(dp.HOUSE_NBR_1 AS TEXT) || COALESCE(dp.HOUSE_NBR_SFX_1, '') ||
  CASE WHEN dp.HOUSE_NBR_2 > 0
    THEN '-' || CAST(dp.HOUSE_NBR_2 AS TEXT) || COALESCE(dp.HOUSE_NBR_SFX_2, '')
    ELSE ''
  END,

  -- Street Name and Type
  dpg.STREET_NAME || ' ' || COALESCE(dpg.STREET_TYPE, '') ||
  COALESCE(' ' || dpg.STREET_SFX, ''),

  -- Postal Delivery (PO Box)
  CASE WHEN dpg.POSTAL_DELIVERY_TYPE IS NOT NULL
    THEN dpg.POSTAL_DELIVERY_TYPE || ' ' || CAST(dp.POSTAL_DELIVERY_NBR AS TEXT)
    ELSE NULL
  END,

  -- Locality/Suburb
  l.LOCALITY_NAME,

  -- State
  l.STATE,

  -- Postcode
  l.POSTCODE

FROM DELIVERY_POINT dp
JOIN DELIVERY_POINT_GROUP dpg ON dp.DELIVY_POINT_GROUP_ID = dpg.DELIVY_POINT_GROUP_ID
JOIN LOCALITY l ON dpg.LOCALITY_ID = l.LOCALITY_ID
LEFT JOIN BUILDING b ON dp.DELIVY_POINT_ID = b.DELIVY_POINT_ID
```

### Sample Address Examples

#### Example 1: Simple Street Address
```
171 LACHLAN ST, FORBES NSW 2871

Components:
- HOUSE_NBR_1: 171
- STREET_NAME: LACHLAN
- STREET_TYPE: ST
- LOCALITY_NAME: FORBES
- STATE: NSW
- POSTCODE: 2871
```

#### Example 2: Unit Address
```
U 505 1 BRIGHTWELL LANE, ERSKINEVILLE NSW 2043

Components:
- FLAT_UNIT_TYPE: U
- FLAT_UNIT_NBR: 505
- HOUSE_NBR_1: 1
- STREET_NAME: BRIGHTWELL
- STREET_TYPE: LANE
- LOCALITY_NAME: ERSKINEVILLE
- STATE: NSW
- POSTCODE: 2043
```

#### Example 3: Complex Address with Building and Floor
```
SHOP 45 L 2 TRINITY ARCADE 671 HAY ST, PERTH WA 6000

Components:
- FLAT_UNIT_TYPE: SHOP
- FLAT_UNIT_NBR: 45
- FLOOR_LEVEL_TYPE: L
- FLOOR_LEVEL_NBR: 2
- BLDG_PROP_NAME_1: TRINITY ARCADE
- HOUSE_NBR_1: 671
- STREET_NAME: HAY
- STREET_TYPE: ST
- LOCALITY_NAME: PERTH
- STATE: WA
- POSTCODE: 6000
```

#### Example 4: Street Number Range
```
80-100 RAILWAY AVE, PARKSIDE QLD 4825

Components:
- HOUSE_NBR_1: 80
- HOUSE_NBR_2: 100
- STREET_NAME: RAILWAY
- STREET_TYPE: AVE
- LOCALITY_NAME: PARKSIDE
- STATE: QLD
- POSTCODE: 4825
```

#### Example 5: PO Box Address
```
PO BOX 470, WAIKERIE SA 5330

Components:
- POSTAL_DELIVERY_TYPE: PO BOX
- POSTAL_DELIVERY_NBR: 470
- LOCALITY_NAME: WAIKERIE
- STATE: SA
- POSTCODE: 5330
```

#### Example 6: Street Number with Suffix
```
1A ANZAC AVE, COBURG NORTH VIC 3058

Components:
- HOUSE_NBR_1: 1
- HOUSE_NBR_SFX_1: A
- STREET_NAME: ANZAC
- STREET_TYPE: AVE
- LOCALITY_NAME: COBURG NORTH
- STATE: VIC
- POSTCODE: 3058
```

### Data Quality Observations

#### NULL Value Analysis

**DELIVERY_POINT:**
- FLAT_UNIT_TYPE: 0 nulls (always populated when unit exists)
- FLAT_UNIT_NBR: 11,981,042 empty (76% don't have units)
- FLOOR_LEVEL_TYPE: 0 nulls
- FLOOR_LEVEL_NBR: 15,653,448 empty (99.5% don't have floors)
- HOUSE_NBR_1: 2,079,272 zero/null (13% - mostly PO Box addresses)
- LOT_NBR: 15,660,391 empty (99.5%)

**DELIVERY_POINT_GROUP:**
- STREET_NAME: 9,529 empty (1.8% - postal delivery addresses)
- STREET_TYPE: 12,037 empty (2.3%)
- STREET_SFX: 514,181 empty (99.6% - rarely used)
- POSTAL_DELIVERY_TYPE: 506,950 empty (98.2% - only for PO Boxes)

**LOCALITY:**
- All fields 100% populated (LOCALITY_NAME, POSTCODE, STATE)

#### Data Pattern Observations

1. **Street Numbers:** Range from 0 to very large numbers (likely thousands)
2. **Unit Numbers:** Alphanumeric (e.g., "1", "505", "1113", "45", "23T")
3. **Floor Numbers:** Alphanumeric (e.g., "2", "6", "B" for basement, "G" for ground)
4. **Postcodes:** 4-digit strings with leading zeros preserved (e.g., "0872", "2640")
5. **Street Types:** 147 unique values (420 possible from CODE table)
6. **Building Names:** Often truncated at 30 characters (e.g., "WESTFIELD DONCASTER SHOPPING C")

## OpenSearch Index Design

### Index Strategy

**Approach:** Single denormalized index with all address components embedded in each document for optimal autocomplete performance.

**Rationale:**
- Eliminates need for joins during search (OpenSearch doesn't support SQL-style joins efficiently)
- Enables fast autocomplete with edge n-gram token filters
- Allows searching across all address components simultaneously
- Supports flexible relevance ranking and boosting

**Trade-offs:**
- Data duplication (15.7M documents with embedded locality/street data)
- Index size larger than normalized approach
- Update complexity (if PAF data changes, must re-index affected documents)
- Acceptable for read-heavy autocomplete workload with infrequent updates

### Index Name and Settings

**Index Name:** `paf-addresses`

**Sharding Strategy:**
- Primary shards: 5 (to distribute 15.7M documents, ~3.1M docs per shard)
- Replica shards: 1 (for high availability and read scaling)
- Refresh interval: 30s (balance between search latency and indexing throughput)

**Index Settings:**

```json
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "max_result_window": 10000,
    "analysis": {
      "analyzer": {
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding",
            "autocomplete_edge_ngram"
          ]
        },
        "autocomplete_search_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        },
        "standard_lowercase": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        }
      },
      "filter": {
        "autocomplete_edge_ngram": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20,
          "preserve_original": true
        }
      }
    }
  }
}
```

### Analyzer Configuration

#### 1. autocomplete_analyzer (Index-time)

**Purpose:** Tokenizes and generates edge n-grams for autocomplete matching.

**Pipeline:**
1. **Tokenizer:** `standard` - Splits on whitespace and punctuation
2. **Filter: lowercase** - Converts to lowercase for case-insensitive search
3. **Filter: asciifolding** - Converts accented characters to ASCII equivalents
4. **Filter: autocomplete_edge_ngram** - Generates n-grams from start of each token

**Example Transformation:**
```
Input: "George Street"
Tokens after standard tokenizer: ["George", "Street"]
After lowercase: ["george", "street"]
After edge_ngram (min=2, max=20):
  From "george": ["ge", "geo", "geor", "georg", "george"]
  From "street": ["st", "str", "stre", "stree", "street"]
```

**Result:** Searching "Geo" matches "George Street" because "geo" n-gram exists.

#### 2. autocomplete_search_analyzer (Search-time)

**Purpose:** Tokenizes search queries without n-grams (match against pre-computed n-grams).

**Pipeline:**
1. **Tokenizer:** `standard`
2. **Filter: lowercase**
3. **Filter: asciifolding**

**Example:**
```
Query: "Geo St"
Tokens: ["geo", "st"]
Matches: Documents with edge n-grams "geo" and "st"
```

**Rationale:** Search terms are NOT n-grammed. Instead, they match against the pre-computed n-grams in the index.

#### 3. standard_lowercase (Exact/Keyword Search)

**Purpose:** For exact phrase matching and postcode search (no n-grams).

**Pipeline:**
1. **Tokenizer:** `standard`
2. **Filter: lowercase**
3. **Filter: asciifolding**

**Use Case:** Exact postcode search ("2000"), exact locality match.

### Field Mappings

```json
{
  "mappings": {
    "properties": {
      "delivery_point_id": {
        "type": "long"
      },
      "delivery_point_group_id": {
        "type": "long"
      },
      "locality_id": {
        "type": "long"
      },

      "unit": {
        "properties": {
          "type": {
            "type": "keyword"
          },
          "number": {
            "type": "keyword"
          },
          "full": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "floor": {
        "properties": {
          "type": {
            "type": "keyword"
          },
          "number": {
            "type": "keyword"
          },
          "full": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "building_name": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "search_analyzer": "autocomplete_search_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },

      "street_number": {
        "properties": {
          "number_1": {
            "type": "integer"
          },
          "suffix_1": {
            "type": "keyword"
          },
          "number_2": {
            "type": "integer"
          },
          "suffix_2": {
            "type": "keyword"
          },
          "full": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "lot_number": {
        "type": "keyword"
      },

      "street": {
        "properties": {
          "name": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 256
              }
            }
          },
          "type": {
            "type": "keyword"
          },
          "suffix": {
            "type": "keyword"
          },
          "full": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "postal_delivery": {
        "properties": {
          "type": {
            "type": "keyword"
          },
          "number": {
            "type": "integer"
          },
          "prefix": {
            "type": "keyword"
          },
          "suffix": {
            "type": "keyword"
          },
          "full": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "locality": {
        "properties": {
          "name": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 256
              }
            }
          },
          "postcode": {
            "type": "keyword"
          },
          "state": {
            "type": "keyword"
          },
          "synonyms": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },

      "street_alternatives": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "search_analyzer": "autocomplete_search_analyzer"
      },

      "primary_point_indicator": {
        "type": "keyword"
      },

      "formatted_address": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "search_analyzer": "autocomplete_search_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 512
          }
        }
      },

      "formatted_address_short": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "search_analyzer": "autocomplete_search_analyzer"
      },

      "search_text": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "search_analyzer": "autocomplete_search_analyzer"
      }
    }
  }
}
```

### Field Descriptions

#### Core Identifiers
- **delivery_point_id**: Unique delivery point ID from PAF (long)
- **delivery_point_group_id**: Street group ID (long)
- **locality_id**: Locality ID (long)

#### Unit/Flat Component
- **unit.type**: Unit type code (keyword, e.g., "U", "APT", "SHOP")
- **unit.number**: Unit number (keyword, alphanumeric)
- **unit.full**: Formatted unit (text with autocomplete, e.g., "U 505")

#### Floor/Level Component
- **floor.type**: Floor type code (keyword, e.g., "L", "G", "B")
- **floor.number**: Floor number (keyword, alphanumeric)
- **floor.full**: Formatted floor (text with autocomplete, e.g., "L 2")

#### Building Component
- **building_name**: Building/property name (text with autocomplete)
- **building_name.keyword**: Exact building name (keyword for sorting/aggregations)

#### Street Number Component
- **street_number.number_1**: Primary street number (integer)
- **street_number.suffix_1**: Primary suffix (keyword, e.g., "A", "B")
- **street_number.number_2**: Secondary street number for ranges (integer)
- **street_number.suffix_2**: Secondary suffix (keyword)
- **street_number.full**: Formatted street number (text with autocomplete, e.g., "171", "80-100", "1A")

#### Lot Number
- **lot_number**: Lot number (keyword)

#### Street Component
- **street.name**: Street name (text with autocomplete)
- **street.name.keyword**: Exact street name (keyword)
- **street.type**: Street type abbreviation (keyword, e.g., "ST", "RD", "AVE")
- **street.suffix**: Street direction suffix (keyword, e.g., "N", "S", "E", "W")
- **street.full**: Formatted street (text with autocomplete, e.g., "George ST", "Main RD N")

#### Postal Delivery Component
- **postal_delivery.type**: Delivery type (keyword, e.g., "PO BOX", "GPO BOX")
- **postal_delivery.number**: PO Box number (integer)
- **postal_delivery.prefix**: Prefix (keyword)
- **postal_delivery.suffix**: Suffix (keyword)
- **postal_delivery.full**: Formatted postal delivery (text with autocomplete, e.g., "PO BOX 470")

#### Locality Component
- **locality.name**: Suburb/town name (text with autocomplete)
- **locality.name.keyword**: Exact locality name (keyword)
- **locality.postcode**: 4-digit postcode (keyword, preserves leading zeros)
- **locality.state**: State abbreviation (keyword, e.g., "NSW", "VIC")
- **locality.synonyms**: Array of alternative locality names (text with autocomplete)

#### Alternative Names
- **street_alternatives**: Array of alternative street names (text with autocomplete)

#### Metadata
- **primary_point_indicator**: Primary point flag (keyword, "P"/"R"/blank)

#### Formatted Addresses
- **formatted_address**: Complete formatted address (text with autocomplete)
  - Format: `[UNIT] [FLOOR] [BUILDING] [STREET_NUMBER] [STREET_NAME] [STREET_TYPE] [STREET_SFX], [LOCALITY] [STATE] [POSTCODE]`
  - Example: `U 505 1 BRIGHTWELL LANE, ERSKINEVILLE NSW 2043`

- **formatted_address_short**: Short formatted address without unit/floor/building (text with autocomplete)
  - Format: `[STREET_NUMBER] [STREET_NAME] [STREET_TYPE], [LOCALITY] [STATE] [POSTCODE]`
  - Example: `1 BRIGHTWELL LANE, ERSKINEVILLE NSW 2043`

- **search_text**: Concatenated searchable text (all components combined for broad matching)

### Sample Document Structure

```json
{
  "delivery_point_id": 30000612,
  "delivery_point_group_id": 702299,
  "locality_id": 13265,

  "unit": {
    "type": "SHOP",
    "number": "45",
    "full": "SHOP 45"
  },

  "floor": {
    "type": "L",
    "number": "2",
    "full": "L 2"
  },

  "building_name": "TRINITY ARCADE",

  "street_number": {
    "number_1": 671,
    "suffix_1": null,
    "number_2": null,
    "suffix_2": null,
    "full": "671"
  },

  "lot_number": null,

  "street": {
    "name": "HAY",
    "type": "ST",
    "suffix": null,
    "full": "HAY ST"
  },

  "postal_delivery": {
    "type": null,
    "number": null,
    "prefix": null,
    "suffix": null,
    "full": null
  },

  "locality": {
    "name": "PERTH",
    "postcode": "6000",
    "state": "WA",
    "synonyms": []
  },

  "street_alternatives": [],

  "primary_point_indicator": "",

  "formatted_address": "SHOP 45 L 2 TRINITY ARCADE 671 HAY ST, PERTH WA 6000",
  "formatted_address_short": "671 HAY ST, PERTH WA 6000",
  "search_text": "SHOP 45 L 2 TRINITY ARCADE 671 HAY ST PERTH WA 6000"
}
```

### Example Document Variations

#### Simple Address (No Unit/Floor/Building)
```json
{
  "delivery_point_id": 30000273,
  "unit": { "type": null, "number": null, "full": null },
  "floor": { "type": null, "number": null, "full": null },
  "building_name": null,
  "street_number": { "number_1": 1, "full": "1" },
  "street": { "name": "FRESHFIELD", "type": "AVE", "full": "FRESHFIELD AVE" },
  "locality": { "name": "WANTIRNA", "postcode": "3152", "state": "VIC" },
  "formatted_address": "1 FRESHFIELD AVE, WANTIRNA VIC 3152",
  "formatted_address_short": "1 FRESHFIELD AVE, WANTIRNA VIC 3152",
  "search_text": "1 FRESHFIELD AVE WANTIRNA VIC 3152"
}
```

#### PO Box Address
```json
{
  "delivery_point_id": 30000014,
  "unit": { "type": null, "number": null, "full": null },
  "floor": { "type": null, "number": null, "full": null },
  "building_name": null,
  "street_number": { "number_1": 0, "full": null },
  "street": { "name": null, "type": null, "full": null },
  "postal_delivery": {
    "type": "PO BOX",
    "number": 470,
    "full": "PO BOX 470"
  },
  "locality": { "name": "WAIKERIE", "postcode": "5330", "state": "SA" },
  "formatted_address": "PO BOX 470, WAIKERIE SA 5330",
  "formatted_address_short": "PO BOX 470, WAIKERIE SA 5330",
  "search_text": "PO BOX 470 WAIKERIE SA 5330"
}
```

#### Street Number Range
```json
{
  "delivery_point_id": 30000938,
  "unit": { "type": "U", "number": "19", "full": "U 19" },
  "building_name": "PARKSIDE FLATS",
  "street_number": {
    "number_1": 80,
    "number_2": 100,
    "full": "80-100"
  },
  "street": { "name": "RAILWAY", "type": "AVE", "full": "RAILWAY AVE" },
  "locality": { "name": "PARKSIDE", "postcode": "4825", "state": "QLD" },
  "formatted_address": "U 19 PARKSIDE FLATS 80-100 RAILWAY AVE, PARKSIDE QLD 4825",
  "formatted_address_short": "80-100 RAILWAY AVE, PARKSIDE QLD 4825",
  "search_text": "U 19 PARKSIDE FLATS 80-100 RAILWAY AVE PARKSIDE QLD 4825"
}
```

## Data Migration Strategy

### ETL Process Overview

**Source:** SQLite database (apfdata.db)
**Target:** OpenSearch index (paf-addresses)
**Volume:** 15.7M documents
**Approach:** Batch processing with Lambda function

### Migration Steps

#### Step 1: Data Extraction (SQLite Query)

Execute single denormalized query with all joins:

```sql
SELECT
  -- IDs
  dp.DELIVY_POINT_ID,
  dp.DELIVY_POINT_GROUP_ID,
  l.LOCALITY_ID,

  -- Unit
  dp.FLAT_UNIT_TYPE,
  dp.FLAT_UNIT_NBR,

  -- Floor
  dp.FLOOR_LEVEL_TYPE,
  dp.FLOOR_LEVEL_NBR,

  -- Building
  b.BLDG_PROP_NAME_1,

  -- Street Number
  dp.HOUSE_NBR_1,
  dp.HOUSE_NBR_SFX_1,
  dp.HOUSE_NBR_2,
  dp.HOUSE_NBR_SFX_2,

  -- Lot
  dp.LOT_NBR,

  -- Street
  dpg.STREET_NAME,
  dpg.STREET_TYPE,
  dpg.STREET_SFX,

  -- Postal Delivery
  dpg.POSTAL_DELIVERY_TYPE,
  dp.POSTAL_DELIVERY_NBR,
  dp.POSTAL_DELIVERY_NBR_PFX,
  dp.POSTAL_DELIVERY_NBR_SFX,

  -- Locality
  l.LOCALITY_NAME,
  l.POSTCODE,
  l.STATE,

  -- Metadata
  dp.PRIMARY_POINT_IND

FROM DELIVERY_POINT dp
JOIN DELIVERY_POINT_GROUP dpg ON dp.DELIVY_POINT_GROUP_ID = dpg.DELIVY_POINT_GROUP_ID
JOIN LOCALITY l ON dpg.LOCALITY_ID = l.LOCALITY_ID
LEFT JOIN BUILDING b ON dp.DELIVY_POINT_ID = b.DELIVY_POINT_ID
ORDER BY dp.DELIVY_POINT_ID;
```

#### Step 2: Synonym and Alternative Name Enrichment

**Locality Synonyms:**
```sql
SELECT
  LOCALITY_ID,
  GROUP_CONCAT(SYNONYM, '|') as synonyms
FROM SYNONYM
WHERE TYPE_ID = 'LOC'
GROUP BY LOCALITY_ID;
```

**Street Alternatives:**
```sql
SELECT
  DELIVY_POINT_GROUP_ID,
  GROUP_CONCAT(ST_ALT_STREET_NAME || ' ' || COALESCE(ST_ALT_STREET_TYPE, ''), '|') as alternatives
FROM STREET_ALT
GROUP BY DELIVY_POINT_GROUP_ID;
```

#### Step 3: Document Transformation

For each row from Step 1, construct OpenSearch document:

```javascript
function transformToDocument(row, synonymMap, alternativesMap) {
  const doc = {
    delivery_point_id: row.DELIVY_POINT_ID,
    delivery_point_group_id: row.DELIVY_POINT_GROUP_ID,
    locality_id: row.LOCALITY_ID,

    // Unit
    unit: {
      type: row.FLAT_UNIT_TYPE || null,
      number: row.FLAT_UNIT_NBR || null,
      full: row.FLAT_UNIT_TYPE && row.FLAT_UNIT_NBR
        ? `${row.FLAT_UNIT_TYPE} ${row.FLAT_UNIT_NBR}`
        : null
    },

    // Floor
    floor: {
      type: row.FLOOR_LEVEL_TYPE || null,
      number: row.FLOOR_LEVEL_NBR || null,
      full: row.FLOOR_LEVEL_TYPE && row.FLOOR_LEVEL_NBR
        ? `${row.FLOOR_LEVEL_TYPE} ${row.FLOOR_LEVEL_NBR}`
        : null
    },

    // Building
    building_name: row.BLDG_PROP_NAME_1 || null,

    // Street Number
    street_number: {
      number_1: row.HOUSE_NBR_1 || null,
      suffix_1: row.HOUSE_NBR_SFX_1 || null,
      number_2: row.HOUSE_NBR_2 || null,
      suffix_2: row.HOUSE_NBR_SFX_2 || null,
      full: formatStreetNumber(row)
    },

    lot_number: row.LOT_NBR || null,

    // Street
    street: {
      name: row.STREET_NAME || null,
      type: row.STREET_TYPE || null,
      suffix: row.STREET_SFX || null,
      full: formatStreet(row)
    },

    // Postal Delivery
    postal_delivery: {
      type: row.POSTAL_DELIVERY_TYPE || null,
      number: row.POSTAL_DELIVERY_NBR || null,
      prefix: row.POSTAL_DELIVERY_NBR_PFX || null,
      suffix: row.POSTAL_DELIVERY_NBR_SFX || null,
      full: formatPostalDelivery(row)
    },

    // Locality
    locality: {
      name: row.LOCALITY_NAME,
      postcode: row.POSTCODE,
      state: row.STATE,
      synonyms: synonymMap[row.LOCALITY_ID] || []
    },

    street_alternatives: alternativesMap[row.DELIVY_POINT_GROUP_ID] || [],

    primary_point_indicator: row.PRIMARY_POINT_IND || null,

    // Formatted addresses
    formatted_address: formatFullAddress(row),
    formatted_address_short: formatShortAddress(row),
    search_text: buildSearchText(row)
  };

  return doc;
}

function formatStreetNumber(row) {
  if (!row.HOUSE_NBR_1 || row.HOUSE_NBR_1 === 0) return null;

  let number = String(row.HOUSE_NBR_1);
  if (row.HOUSE_NBR_SFX_1) number += row.HOUSE_NBR_SFX_1;

  if (row.HOUSE_NBR_2 && row.HOUSE_NBR_2 > 0) {
    number += '-' + row.HOUSE_NBR_2;
    if (row.HOUSE_NBR_SFX_2) number += row.HOUSE_NBR_SFX_2;
  }

  return number;
}

function formatStreet(row) {
  if (!row.STREET_NAME) return null;

  let street = row.STREET_NAME;
  if (row.STREET_TYPE) street += ' ' + row.STREET_TYPE;
  if (row.STREET_SFX) street += ' ' + row.STREET_SFX;

  return street;
}

function formatPostalDelivery(row) {
  if (!row.POSTAL_DELIVERY_TYPE || !row.POSTAL_DELIVERY_NBR) return null;

  let postal = row.POSTAL_DELIVERY_TYPE + ' ' + row.POSTAL_DELIVERY_NBR;
  if (row.POSTAL_DELIVERY_NBR_PFX) postal = row.POSTAL_DELIVERY_NBR_PFX + ' ' + postal;
  if (row.POSTAL_DELIVERY_NBR_SFX) postal += ' ' + row.POSTAL_DELIVERY_NBR_SFX;

  return postal;
}

function formatFullAddress(row) {
  const parts = [];

  // Unit
  if (row.FLAT_UNIT_TYPE && row.FLAT_UNIT_NBR) {
    parts.push(`${row.FLAT_UNIT_TYPE} ${row.FLAT_UNIT_NBR}`);
  }

  // Floor
  if (row.FLOOR_LEVEL_TYPE && row.FLOOR_LEVEL_NBR) {
    parts.push(`${row.FLOOR_LEVEL_TYPE} ${row.FLOOR_LEVEL_NBR}`);
  }

  // Building
  if (row.BLDG_PROP_NAME_1) {
    parts.push(row.BLDG_PROP_NAME_1);
  }

  // Street address OR Postal delivery
  if (row.POSTAL_DELIVERY_TYPE && row.POSTAL_DELIVERY_NBR) {
    parts.push(formatPostalDelivery(row));
  } else {
    if (row.HOUSE_NBR_1 && row.HOUSE_NBR_1 > 0) {
      parts.push(formatStreetNumber(row));
    }
    if (row.STREET_NAME) {
      parts.push(formatStreet(row));
    }
  }

  const streetPart = parts.join(' ');

  // Locality, State, Postcode
  const localityPart = `${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`;

  return `${streetPart}, ${localityPart}`.trim();
}

function formatShortAddress(row) {
  const parts = [];

  // Street address OR Postal delivery (no unit/floor/building)
  if (row.POSTAL_DELIVERY_TYPE && row.POSTAL_DELIVERY_NBR) {
    parts.push(formatPostalDelivery(row));
  } else {
    if (row.HOUSE_NBR_1 && row.HOUSE_NBR_1 > 0) {
      parts.push(formatStreetNumber(row));
    }
    if (row.STREET_NAME) {
      parts.push(formatStreet(row));
    }
  }

  const streetPart = parts.join(' ');
  const localityPart = `${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`;

  return `${streetPart}, ${localityPart}`.trim();
}

function buildSearchText(row) {
  const parts = [];

  if (row.FLAT_UNIT_TYPE && row.FLAT_UNIT_NBR) parts.push(`${row.FLAT_UNIT_TYPE} ${row.FLAT_UNIT_NBR}`);
  if (row.FLOOR_LEVEL_TYPE && row.FLOOR_LEVEL_NBR) parts.push(`${row.FLOOR_LEVEL_TYPE} ${row.FLOOR_LEVEL_NBR}`);
  if (row.BLDG_PROP_NAME_1) parts.push(row.BLDG_PROP_NAME_1);

  if (row.POSTAL_DELIVERY_TYPE && row.POSTAL_DELIVERY_NBR) {
    parts.push(formatPostalDelivery(row));
  } else {
    if (row.HOUSE_NBR_1 && row.HOUSE_NBR_1 > 0) parts.push(formatStreetNumber(row));
    if (row.STREET_NAME) parts.push(formatStreet(row));
  }

  parts.push(row.LOCALITY_NAME);
  parts.push(row.STATE);
  parts.push(row.POSTCODE);

  return parts.filter(p => p).join(' ');
}
```

#### Step 4: Bulk Indexing to OpenSearch

Use OpenSearch Bulk API for efficient indexing:

```javascript
async function bulkIndexDocuments(documents, indexName) {
  const bulkBody = [];

  for (const doc of documents) {
    bulkBody.push({
      index: {
        _index: indexName,
        _id: String(doc.delivery_point_id)
      }
    });
    bulkBody.push(doc);
  }

  const response = await opensearchClient.bulk({
    body: bulkBody,
    refresh: false  // Don't refresh after each bulk request
  });

  if (response.errors) {
    // Handle errors
    const erroredDocuments = [];
    response.items.forEach((action, i) => {
      const operation = Object.keys(action)[0];
      if (action[operation].error) {
        erroredDocuments.push({
          status: action[operation].status,
          error: action[operation].error,
          document: documents[i]
        });
      }
    });
    console.error('Bulk indexing errors:', erroredDocuments);
  }

  return response;
}
```

#### Step 5: Batch Processing Strategy

**Approach:** Process in batches of 10,000 documents

```javascript
const BATCH_SIZE = 10000;
const TOTAL_RECORDS = 15_733_809;
const NUM_BATCHES = Math.ceil(TOTAL_RECORDS / BATCH_SIZE); // ~1,574 batches

async function migratePAFData() {
  console.log(`Starting migration of ${TOTAL_RECORDS} records in ${NUM_BATCHES} batches`);

  // Load synonym and alternative maps once
  const synonymMap = await loadSynonymMap();
  const alternativesMap = await loadAlternativesMap();

  for (let offset = 0; offset < TOTAL_RECORDS; offset += BATCH_SIZE) {
    const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
    console.log(`Processing batch ${batchNum}/${NUM_BATCHES} (offset: ${offset})`);

    // Extract batch from SQLite
    const rows = await executeQuery(`
      SELECT ...
      FROM DELIVERY_POINT dp ...
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `);

    // Transform to documents
    const documents = rows.map(row =>
      transformToDocument(row, synonymMap, alternativesMap)
    );

    // Bulk index to OpenSearch
    await bulkIndexDocuments(documents, 'paf-addresses');

    // Progress logging
    const progress = ((offset + rows.length) / TOTAL_RECORDS * 100).toFixed(2);
    console.log(`Progress: ${progress}% (${offset + rows.length}/${TOTAL_RECORDS})`);
  }

  console.log('Migration complete. Refreshing index...');
  await opensearchClient.indices.refresh({ index: 'paf-addresses' });
  console.log('Index refreshed.');
}
```

### Migration Considerations

#### Performance Optimization

1. **Disable Refresh During Bulk Indexing**
   - Set `refresh_interval: -1` during import
   - Re-enable after completion: `refresh_interval: 30s`

2. **Increase Bulk Thread Pool**
   - Configure OpenSearch cluster for higher bulk throughput
   - Monitor bulk queue and rejection metrics

3. **Lambda Timeout**
   - Use Step Functions for orchestration if batches take > 15 minutes
   - Or process in ECS task for long-running migration

4. **SQLite Read Performance**
   - Ensure indexes exist on join columns (they already do)
   - Use read-only connection for better performance
   - Consider loading SQLite file into memory for fastest reads

#### Estimated Migration Time

**Assumptions:**
- Batch size: 10,000 documents
- Bulk indexing rate: ~2,000 docs/second (conservative)
- Total batches: ~1,574

**Calculation:**
- Time per batch: 10,000 / 2,000 = 5 seconds
- Total time: 1,574 batches * 5 seconds = 7,870 seconds ≈ 2.2 hours

**With overhead (query, transform, network):**
- Estimated total time: 3-4 hours

#### Data Validation

After migration, validate:

```javascript
async function validateMigration() {
  // 1. Document count
  const countResponse = await opensearchClient.count({ index: 'paf-addresses' });
  console.log(`Indexed documents: ${countResponse.count}`);
  console.log(`Expected: 15,733,809`);

  // 2. Sample address verification
  const sampleIds = [30000612, 30000273, 30000014, 30000938];
  for (const id of sampleIds) {
    const doc = await opensearchClient.get({
      index: 'paf-addresses',
      id: String(id)
    });
    console.log(`Sample ${id}:`, doc._source.formatted_address);
  }

  // 3. Search functionality test
  const searchResult = await opensearchClient.search({
    index: 'paf-addresses',
    body: {
      query: {
        multi_match: {
          query: 'George Street Sydney',
          fields: ['search_text', 'street.name', 'locality.name']
        }
      },
      size: 5
    }
  });

  console.log('Search test results:', searchResult.hits.total.value);
}
```

## Autocomplete Query Design

### Multi-Field Match Query

Search across multiple fields with boosting:

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "match": {
            "formatted_address": {
              "query": "123 Geo",
              "boost": 3.0
            }
          }
        },
        {
          "match": {
            "search_text": {
              "query": "123 Geo",
              "boost": 2.0
            }
          }
        },
        {
          "match": {
            "street.name": {
              "query": "Geo",
              "boost": 2.5
            }
          }
        },
        {
          "match": {
            "locality.name": {
              "query": "Geo",
              "boost": 1.5
            }
          }
        },
        {
          "match": {
            "building_name": {
              "query": "Geo",
              "boost": 1.0
            }
          }
        },
        {
          "match": {
            "locality.postcode": {
              "query": "123",
              "boost": 2.0
            }
          }
        }
      ],
      "minimum_should_match": 1
    }
  },
  "size": 10,
  "_source": [
    "delivery_point_id",
    "formatted_address",
    "formatted_address_short",
    "locality.postcode",
    "locality.state"
  ],
  "sort": [
    { "_score": { "order": "desc" } }
  ]
}
```

### Postcode-First Query

When user types postcode first (e.g., "2000 George"):

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "locality.postcode": "2000"
          }
        }
      ],
      "should": [
        {
          "match": {
            "street.name": {
              "query": "George",
              "boost": 3.0
            }
          }
        },
        {
          "match": {
            "locality.name": {
              "query": "George",
              "boost": 2.0
            }
          }
        }
      ],
      "minimum_should_match": 1
    }
  },
  "size": 10
}
```

### Locality-Biased Query

Bias results toward specific locality (e.g., user is in Sydney):

```json
{
  "query": {
    "function_score": {
      "query": {
        "multi_match": {
          "query": "George Street",
          "fields": [
            "formatted_address^3",
            "search_text^2",
            "street.name^2.5",
            "locality.name^1.5"
          ]
        }
      },
      "functions": [
        {
          "filter": {
            "term": {
              "locality.name.keyword": "SYDNEY"
            }
          },
          "weight": 2.0
        }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  },
  "size": 10
}
```

### Fuzzy Matching for Typos

Handle typos and misspellings:

```json
{
  "query": {
    "multi_match": {
      "query": "Georg Streat Sidny",
      "fields": [
        "street.name",
        "locality.name",
        "formatted_address"
      ],
      "fuzziness": "AUTO",
      "prefix_length": 2,
      "max_expansions": 50
    }
  },
  "size": 10
}
```

### Sample Lambda Handler for Autocomplete

```typescript
import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.OPENSEARCH_ENDPOINT,
  // ... auth configuration
});

export async function handler(event: any) {
  const query = event.queryStringParameters?.query || '';
  const limit = parseInt(event.queryStringParameters?.limit || '10');

  if (!query || query.length < 2) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Query must be at least 2 characters' })
    };
  }

  try {
    const response = await client.search({
      index: 'paf-addresses',
      body: {
        query: {
          bool: {
            should: [
              {
                match: {
                  formatted_address: {
                    query: query,
                    boost: 3.0
                  }
                }
              },
              {
                match: {
                  search_text: {
                    query: query,
                    boost: 2.0
                  }
                }
              },
              {
                match: {
                  'street.name': {
                    query: query,
                    boost: 2.5
                  }
                }
              },
              {
                match: {
                  'locality.name': {
                    query: query,
                    boost: 1.5
                  }
                }
              },
              {
                match: {
                  'locality.postcode': {
                    query: query,
                    boost: 2.0
                  }
                }
              }
            ],
            minimum_should_match: 1
          }
        },
        size: limit,
        _source: [
          'delivery_point_id',
          'formatted_address',
          'formatted_address_short',
          'locality.postcode',
          'locality.state',
          'locality.name'
        ]
      }
    });

    const results = response.body.hits.hits.map((hit: any) => ({
      id: hit._source.delivery_point_id,
      address: hit._source.formatted_address,
      shortAddress: hit._source.formatted_address_short,
      suburb: hit._source.locality.name,
      state: hit._source.locality.state,
      postcode: hit._source.locality.postcode,
      score: hit._score
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        query: query,
        count: results.length,
        total: response.body.hits.total.value,
        results: results
      })
    };

  } catch (error) {
    console.error('OpenSearch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Search failed' })
    };
  }
}
```

## Index Size Estimation

### Document Size Calculation

**Average document size estimate:**

```json
{
  // Identifiers: ~30 bytes
  "delivery_point_id": 30000612,
  "delivery_point_group_id": 702299,
  "locality_id": 13265,

  // Unit: ~40 bytes (when populated, 24% of docs)
  "unit": { "type": "SHOP", "number": "45", "full": "SHOP 45" },

  // Floor: ~30 bytes (when populated, 0.5% of docs)
  "floor": { "type": "L", "number": "2", "full": "L 2" },

  // Building: ~30 bytes (when populated, 1% of docs)
  "building_name": "TRINITY ARCADE",

  // Street number: ~50 bytes
  "street_number": { "number_1": 671, "full": "671" },

  // Street: ~60 bytes
  "street": { "name": "HAY", "type": "ST", "full": "HAY ST" },

  // Locality: ~70 bytes
  "locality": { "name": "PERTH", "postcode": "6000", "state": "WA" },

  // Formatted addresses: ~120 bytes
  "formatted_address": "SHOP 45 L 2 TRINITY ARCADE 671 HAY ST, PERTH WA 6000",
  "formatted_address_short": "671 HAY ST, PERTH WA 6000",
  "search_text": "SHOP 45 L 2 TRINITY ARCADE 671 HAY ST PERTH WA 6000"
}
```

**Average JSON document size:** ~400-500 bytes per document

**With OpenSearch overhead (inverted index, doc values, etc.):**
- Multiply by factor of 3-4 for total storage
- Edge n-gram tokens significantly increase index size (each token stored separately)
- Estimated: ~1.5-2 KB per document

**Total Index Size Calculation:**
- 15,733,809 documents * 1.75 KB average = 27.5 GB
- With replica (1 replica): 27.5 GB * 2 = 55 GB

**Recommended OpenSearch Cluster:**
- Instance type: r6g.large.search (16 GB RAM, 2 vCPU)
- Number of data nodes: 3-5 nodes
- EBS storage: 100 GB per node (total 300-500 GB available)
- Total cluster cost: ~$300-500/month (on-demand pricing)

## Performance Benchmarks

### Expected Query Performance

**Target:** < 100ms for autocomplete queries

**Factors Affecting Performance:**
- Query complexity (multi-match vs simple match)
- Result size (limit 10 vs 100)
- Cache hit ratio (frequently searched terms cached)
- Cluster size and instance type

**Optimization Strategies:**
1. **Request Cache:** Enable for repeated queries
2. **Field Data Cache:** Cache postcode and state fields
3. **Shard Routing:** Route queries by state if implementing state-specific shards
4. **Result Window:** Limit deep pagination (max_result_window: 10000)

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Index size larger than estimated | High | Medium | Monitor index size during migration, add nodes if needed |
| Migration takes longer than 4 hours | Medium | Low | Use ECS task instead of Lambda for long-running migration |
| Edge n-gram tokens exhaust cluster memory | High | Low | Monitor heap usage, reduce max_gram from 20 to 15 if needed |
| Autocomplete queries > 100ms | High | Medium | Implement request caching, optimize query structure, add more nodes |
| Data inconsistency after migration | High | Low | Comprehensive validation after migration, spot-check addresses |
| PAF data updates require full re-index | Medium | High | Implement incremental update strategy (track RECORD_ACTN_CODE) |

## Open Questions

1. **Q:** Should we implement state-specific index sharding for better locality-based search?
   **Decision Needed By:** Before migration
   **Options:** Single index (simpler) vs State-sharded indices (better locality performance)

2. **Q:** What is the PAF update frequency and delta size?
   **Decision Needed By:** Before production
   **Impact:** Determines incremental update vs full re-index strategy

3. **Q:** Should we include bordering locality data for "did you mean" suggestions?
   **Decision Needed By:** Post-MVP
   **Options:** Yes (better UX) vs No (simpler index)

4. **Q:** Do we need coordinate-based search capabilities in OpenSearch?
   **Decision Needed By:** Requirements clarification
   **Impact:** If yes, need to add geo_point field and modify mapping

## Next Steps (Implementation Plan)

### Phase 1: Index Setup (Week 1)
**Step 1:** Provision OpenSearch cluster (3 r6g.large.search nodes)
- Set up VPC and security groups
- Configure cluster settings
- Enable fine-grained access control

**Step 2:** Create index with mappings
- Deploy index creation script
- Verify analyzer configurations
- Test edge n-gram behavior with sample data

**Step 3:** Test autocomplete with sample data (100 documents)
- Index sample addresses
- Test various query patterns
- Measure query latency

### Phase 2: Data Migration (Week 2)
**Step 4:** Build ETL Lambda function
- SQLite extraction logic
- Document transformation
- Bulk indexing to OpenSearch

**Step 5:** Execute migration (3-4 hours)
- Disable index refresh
- Run batch migration
- Monitor progress and errors

**Step 6:** Validation and testing
- Verify document count (15.7M)
- Spot-check address accuracy
- Test autocomplete queries
- Performance benchmarking

### Phase 3: Integration (Week 3)
**Step 7:** Update Lambda autocomplete handler
- Replace mock data with OpenSearch queries
- Implement error handling
- Add query result caching

**Step 8:** API Gateway integration
- Update endpoint to use new Lambda
- Configure throttling and quotas
- Add CloudWatch alarms

**Step 9:** Load testing
- Simulate concurrent autocomplete requests
- Measure p95/p99 latencies
- Identify bottlenecks

### Phase 4: Optimization (Week 4)
**Step 10:** Performance tuning
- Optimize query structure based on load test results
- Adjust cluster settings (cache sizes, heap)
- Implement request caching if needed

**Step 11:** Monitoring and alerting
- Set up CloudWatch dashboards
- Configure alarms for high latency, errors
- Document runbook for common issues

**Step 12:** Documentation and handoff
- API documentation
- Operational runbook
- Performance baseline metrics

## References

- Australian PAF Data Standard: Australia Post Address Data Guide
- OpenSearch Documentation: https://opensearch.org/docs/latest/
- OpenSearch Edge N-gram Tokenizer: https://opensearch.org/docs/latest/analyzers/token-filters/edge-ngram/
- AWS OpenSearch Service: https://docs.aws.amazon.com/opensearch-service/
- OpenSearch Bulk API: https://opensearch.org/docs/latest/api-reference/document-apis/bulk/

---

**Document Version:** 1.0
**Last Updated:** 2026-02-05
**Author:** Technical Lead Agent (Claude Code)
**Status:** Design Complete - Ready for Implementation
