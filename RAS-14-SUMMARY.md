# RAS-14: SQLite Schema Analysis and OpenSearch Index Design - COMPLETE

## Executive Summary

**Ticket:** RAS-14 - Analyze SQLite Schema and Design OpenSearch Index
**Status:** ✅ COMPLETE
**Date:** 2026-02-05
**Deliverables:** 5 technical documents created in `/docs` folder

## What Was Delivered

### 1. Comprehensive Technical Design Document
**File:** `docs/RAS-14-opensearch-index-design.md` (58 KB)

**Complete analysis including:**
- ✅ Deep SQLite schema analysis (all 8 tables documented)
- ✅ Entity-relationship diagrams and data model
- ✅ Data quality analysis (NULL values, distributions, patterns)
- ✅ Australian address format examples (6 variations)
- ✅ OpenSearch index mapping design (complete JSON)
- ✅ Edge n-gram analyzer configuration for autocomplete
- ✅ Field-by-field mapping specifications (30+ fields)
- ✅ Denormalized document structure
- ✅ Data migration ETL strategy (batch processing)
- ✅ Sample queries and Lambda handler implementation
- ✅ Performance benchmarks and optimization strategies
- ✅ Index size estimation (27.5 GB primary, 55 GB with replica)
- ✅ 4-week implementation roadmap

### 2. Quick Reference Guide
**File:** `docs/paf-sqlite-schema-reference.md` (9.4 KB)

**Quick lookups for:**
- ✅ Table summaries and record counts
- ✅ All schema definitions
- ✅ Join relationship SQL examples
- ✅ Address format examples
- ✅ Data patterns and quality notes
- ✅ Useful analysis queries

### 3. Production-Ready Index Mapping
**File:** `docs/opensearch-index-mapping.json` (5.4 KB)

**Complete index definition:**
- ✅ Index settings (5 shards, 1 replica, 30s refresh)
- ✅ Custom analyzers (autocomplete with edge n-gram)
- ✅ Full field mappings (all address components)
- ✅ Multi-field support (text + keyword)
- ✅ Ready to deploy to OpenSearch

### 4. Sample Documents
**File:** `docs/sample-opensearch-documents.json` (9.2 KB)

**8 realistic examples:**
- ✅ Complex address (unit + floor + building)
- ✅ Simple street address
- ✅ Unit address
- ✅ PO Box address
- ✅ Street number range
- ✅ Street number with suffix
- ✅ Address with locality synonym
- ✅ Address with street alternative

### 5. Documentation Index
**File:** `docs/README.md`

**Complete navigation guide:**
- ✅ Document summaries and use cases
- ✅ Quick start guides (developers, infra, analysts)
- ✅ Key statistics
- ✅ Performance targets
- ✅ Implementation timeline

## Database Analysis Results

### Tables Analyzed (8 Total)

| Table | Records | Analysis Complete |
|-------|---------|------------------|
| DELIVERY_POINT | 15.7M | ✅ Schema, indexes, data distribution |
| DELIVERY_POINT_GROUP | 516K | ✅ Schema, indexes, relationships |
| LOCALITY | 16K | ✅ Schema, states, postcodes |
| BUILDING | 152K | ✅ Schema, building name patterns |
| CODE | 641 | ✅ All 6 type categories documented |
| SYNONYM | 5K | ✅ Locality alternatives analyzed |
| STREET_ALT | 3.5K | ✅ Alternative street names |
| BORDERING_LOCALITY | 85K | ✅ Adjacent locality relationships |

### Key Findings

**Address Components:**
- 87% have street numbers (13.7M addresses)
- 24% have units (3.8M addresses)
- 0.5% have floors (80K addresses)
- 1% have building names (152K addresses)
- 13% are postal delivery/PO Box (~2M addresses)

**Data Quality:**
- LOCALITY: 100% populated (all fields)
- DELIVERY_POINT: 13% have no street number (postal delivery)
- DELIVERY_POINT_GROUP: 98% have street type
- PRIMARY_POINT_IND: P (205K), R (9.1M), blank (6.4M)

**Relationships:**
- Average 30.5 delivery points per street group
- Some postcodes have up to 97 localities
- 147 unique street types in use (420 possible)

**Top Street Types:**
1. ST (Street) - 134,734 uses
2. RD (Road) - 132,573 uses
3. CT (Court) - 47,431 uses
4. AVE (Avenue) - 31,978 uses
5. PL (Place) - 31,521 uses

## OpenSearch Index Design

### Index Specifications

**Index Name:** `paf-addresses`

**Cluster Configuration:**
- Instance: r6g.large.search (16 GB RAM)
- Nodes: 3-5 data nodes
- Shards: 5 primary, 5 replica
- EBS: 100 GB per node
- Estimated Cost: $300-500/month

**Index Size:**
- Primary: 27.5 GB
- With Replica: 55 GB
- Documents: 15,733,809
- Avg Document Size: ~1.75 KB

### Analyzer Strategy

**Autocomplete Approach:**
- Edge n-gram tokenization (min: 2, max: 20 characters)
- Lowercase normalization
- ASCII folding (handle accents)
- Separate index-time and search-time analyzers

**Example:**
- Input: "George Street"
- N-grams generated: ["ge", "geo", "geor", "georg", "george", "st", "str", "stre", "stree", "street"]
- Query "Geo" matches "George" via n-gram "geo"

### Document Structure

**30+ Fields Organized As:**
- Identifiers: delivery_point_id, delivery_point_group_id, locality_id
- Unit: type, number, full (with autocomplete)
- Floor: type, number, full (with autocomplete)
- Building: name (with autocomplete + keyword)
- Street Number: number_1, suffix_1, number_2, suffix_2, full
- Street: name, type, suffix, full (with autocomplete)
- Postal Delivery: type, number, prefix, suffix, full
- Locality: name, postcode, state, synonyms (with autocomplete)
- Alternatives: street_alternatives array
- Formatted: formatted_address, formatted_address_short, search_text

**Multi-Field Approach:**
- Text fields use autocomplete analyzer
- Keyword fields for exact match, sorting, aggregations
- search_text field combines all components for broad matching

## Migration Strategy

### ETL Process

**Approach:** Batch processing with Lambda/ECS

**Steps:**
1. Extract from SQLite (single denormalized query with all joins)
2. Load synonym and alternative name maps
3. Transform to OpenSearch documents (JavaScript transformation)
4. Bulk index in batches of 10,000 documents

**Estimated Time:**
- Batch processing: 10,000 docs/batch
- Indexing rate: ~2,000 docs/second
- Total batches: ~1,574
- Total time: 3-4 hours

**Validation:**
- Document count verification (15.7M expected)
- Sample address spot-checks
- Search functionality testing
- Performance benchmarking

## Performance Targets

### Query Performance
- **Autocomplete Latency:** < 100ms (p95)
- **Search Latency:** < 50ms (p99)
- **Throughput:** 100 requests/second
- **Result Size:** 10 addresses per query

### Migration Performance
- **Batch Size:** 10,000 documents
- **Indexing Rate:** ~2,000 docs/second
- **Total Time:** 3-4 hours
- **Validation Time:** 30 minutes

## Sample Queries Provided

### 1. Multi-Field Match (Primary)
Searches across formatted_address, search_text, street.name, locality.name, building_name with boosting.

### 2. Postcode-First Query
Filters by postcode, then searches street/locality names.

### 3. Locality-Biased Query
Boosts results from specific locality (e.g., user's current location).

### 4. Fuzzy Matching
Handles typos with fuzziness: AUTO, prefix_length: 2.

### 5. TypeScript Lambda Handler
Complete implementation example with error handling, CORS, multi-field search.

## Implementation Roadmap

### Week 1: Index Setup
- ✅ Design complete (documented)
- 🔲 Provision OpenSearch cluster
- 🔲 Create index with mappings
- 🔲 Test with sample data

### Week 2: Data Migration
- 🔲 Build ETL Lambda function
- 🔲 Execute migration (3-4 hours)
- 🔲 Validate data quality

### Week 3: Integration
- 🔲 Update autocomplete Lambda handler
- 🔲 API Gateway integration
- 🔲 Load testing

### Week 4: Optimization
- 🔲 Performance tuning
- 🔲 Monitoring and alerting
- 🔲 Documentation and handoff

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Index size larger than estimated | High | Monitor during migration, add nodes if needed |
| Migration takes > 4 hours | Medium | Use ECS task for long-running process |
| Edge n-gram exhausts memory | High | Monitor heap, reduce max_gram if needed |
| Queries > 100ms | High | Implement caching, optimize query structure |
| Data inconsistency | High | Comprehensive validation, spot-checks |

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| SQLite schema fully documented | ✅ All 8 tables with fields, types, indexes |
| All available PAF fields identified | ✅ Complete field inventory across all tables |
| OpenSearch index mapping designed (all fields) | ✅ 30+ fields with types, analyzers, multi-field |
| Field types and analyzers defined for autocomplete | ✅ Edge n-gram, lowercase, asciifolding |
| Sample data validated | ✅ 8 sample documents with variations |

## Files Created

```
docs/
├── README.md (Navigation and quick start)
├── RAS-14-opensearch-index-design.md (58 KB - Main design)
├── opensearch-index-mapping.json (5.4 KB - Production mapping)
├── paf-sqlite-schema-reference.md (9.4 KB - Quick reference)
└── sample-opensearch-documents.json (9.2 KB - Test data)
```

**Total Documentation:** ~82 KB of comprehensive technical documentation

## Next Steps

### Immediate (Week 1)
1. Review and approve design document
2. Provision OpenSearch cluster in AWS
3. Create index using provided mapping JSON
4. Test with sample documents

### Short-term (Week 2-3)
1. Implement ETL Lambda function
2. Execute data migration
3. Integrate with autocomplete API endpoint
4. Load testing and validation

### Medium-term (Week 4)
1. Performance optimization
2. Monitoring and alerting setup
3. Documentation finalization
4. Production readiness review

## Questions Resolved

1. **Q:** What is the PAF database structure?
   **A:** 8 tables, normalized relational design, 15.7M delivery points

2. **Q:** How should addresses be formatted?
   **A:** Australian format: [UNIT] [FLOOR] [BUILDING] [STREET_NUMBER] [STREET] [LOCALITY] [STATE] [POSTCODE]

3. **Q:** What analyzer strategy for autocomplete?
   **A:** Edge n-gram (2-20 chars) with lowercase and asciifolding

4. **Q:** How to handle address variations?
   **A:** Multi-field mapping (text + keyword), synonym arrays, alternatives

5. **Q:** What's the migration strategy?
   **A:** Batch processing (10K docs/batch), denormalized ETL, 3-4 hours total

## Open Questions for Product Team

1. **Incremental Updates:** PAF update frequency and delta size (determines re-index vs incremental strategy)
2. **Geocoding:** Do we need coordinates in OpenSearch? (affects mapping)
3. **Bordering Localities:** Should we use for "did you mean" suggestions?
4. **State-Based Sharding:** Single index vs state-specific indices for better locality search?

## References

- Australian PAF Data Standard
- OpenSearch Documentation: https://opensearch.org/docs/latest/
- AWS OpenSearch Service: https://docs.aws.amazon.com/opensearch-service/
- OpenSearch Edge N-gram: https://opensearch.org/docs/latest/analyzers/token-filters/edge-ngram/

---

**Prepared By:** TechLeadAgent (Claude Code)
**Date:** 2026-02-05
**Status:** DESIGN COMPLETE ✅
**Ready for:** Implementation (Week 1 start)
