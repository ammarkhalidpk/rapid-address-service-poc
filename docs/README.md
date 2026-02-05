# Rapid Address Service - Technical Documentation

This directory contains comprehensive technical documentation for the Rapid Address Service POC, including database analysis, OpenSearch index design, and implementation guides.

## Documentation Index

### 1. RAS-14: OpenSearch Index Design (Primary Document)
**File:** [RAS-14-opensearch-index-design.md](./RAS-14-opensearch-index-design.md)

**Comprehensive technical design covering:**
- Complete SQLite database analysis (1.6 GB, 15.7M addresses)
- Detailed schema documentation for all 8 tables
- Entity-relationship diagrams
- Data quality analysis and NULL value distribution
- Australian address format examples
- OpenSearch index mapping design with edge n-gram analyzers
- Field-by-field mapping specifications
- Data migration ETL strategy
- Sample queries and autocomplete implementation
- Performance benchmarks and optimization strategies
- Index size estimation (27.5 GB primary, 55 GB with replica)
- Implementation plan (4-week roadmap)

**Use this document for:**
- Understanding the PAF database structure
- Implementing the OpenSearch migration
- Designing autocomplete queries
- Performance tuning and optimization

### 2. SQLite Schema Quick Reference
**File:** [paf-sqlite-schema-reference.md](./paf-sqlite-schema-reference.md)

**Quick reference guide including:**
- Table summary and record counts
- Core table schemas (DELIVERY_POINT, DELIVERY_POINT_GROUP, LOCALITY, BUILDING)
- Reference table descriptions (CODE, SYNONYM, STREET_ALT, BORDERING_LOCALITY)
- Complete join relationships and SQL examples
- Address format examples
- Data quality notes and patterns
- Primary keys and indexes
- Useful queries for analysis

**Use this document for:**
- Quick lookups during development
- Understanding table relationships
- Writing SQL queries against the PAF database
- Data quality validation

### 3. OpenSearch Index Mapping (JSON)
**File:** [opensearch-index-mapping.json](./opensearch-index-mapping.json)

**Production-ready OpenSearch index definition:**
- Complete index settings (5 shards, 1 replica, 30s refresh)
- Custom analyzer configurations (autocomplete_analyzer, autocomplete_search_analyzer)
- Edge n-gram token filter (min_gram: 2, max_gram: 20)
- Full field mappings for all address components
- Multi-field support (text + keyword)

**Use this document for:**
- Creating the OpenSearch index via API
- Reference during Lambda handler development
- Index configuration in infrastructure as code (CDK)

### 4. Sample OpenSearch Documents
**File:** [sample-opensearch-documents.json](./sample-opensearch-documents.json)

**8 realistic sample documents covering:**
1. Complex address (unit + floor + building)
2. Simple street address
3. Unit address
4. PO Box address
5. Street number range
6. Street number with suffix
7. Address with locality synonym
8. Address with street alternative

**Use this document for:**
- Testing OpenSearch index creation
- Understanding document structure
- Validating ETL transformation logic
- Sample data for autocomplete query testing

## Quick Start Guide

### For Developers

1. **Understand the Data Model**
   - Start with [paf-sqlite-schema-reference.md](./paf-sqlite-schema-reference.md)
   - Review the join relationships and address examples
   - Run sample queries against apfdata.db

2. **Review Index Design**
   - Read the OpenSearch design in [RAS-14-opensearch-index-design.md](./RAS-14-opensearch-index-design.md)
   - Understand the denormalized document structure
   - Review the analyzer configuration (edge n-gram strategy)

3. **Create OpenSearch Index**
   - Use [opensearch-index-mapping.json](./opensearch-index-mapping.json)
   - Test with sample documents from [sample-opensearch-documents.json](./sample-opensearch-documents.json)

4. **Implement ETL**
   - Follow the migration strategy in the main design document
   - Use the document transformation code examples
   - Process in 10,000-document batches

5. **Build Autocomplete Handler**
   - Use the sample Lambda handler from the design doc
   - Test with various query patterns
   - Optimize based on performance metrics

### For Infrastructure Engineers

1. **Provision OpenSearch Cluster**
   - Instance type: r6g.large.search (16 GB RAM)
   - Number of nodes: 3-5
   - EBS storage: 100 GB per node
   - Region: ap-southeast-2

2. **Create Index**
   ```bash
   curl -X PUT "https://your-opensearch-endpoint/paf-addresses" \
     -H 'Content-Type: application/json' \
     -d @opensearch-index-mapping.json
   ```

3. **Configure Lambda**
   - Runtime: Node.js 20.x
   - Memory: 512 MB (for ETL), 256 MB (for autocomplete)
   - Timeout: 15 minutes (ETL), 30 seconds (autocomplete)
   - VPC: Same VPC as OpenSearch cluster
   - Environment variables:
     - OPENSEARCH_ENDPOINT
     - OPENSEARCH_INDEX_NAME=paf-addresses

4. **Monitor Performance**
   - CloudWatch metrics: latency, error rate, throughput
   - OpenSearch cluster metrics: heap usage, search latency
   - Index size and document count

### For Data Analysts

1. **Explore SQLite Database**
   ```bash
   sqlite3 /path/to/apfdata.db
   .tables
   .schema DELIVERY_POINT
   SELECT COUNT(*) FROM DELIVERY_POINT;
   ```

2. **Analyze Address Distribution**
   - Use queries from [paf-sqlite-schema-reference.md](./paf-sqlite-schema-reference.md)
   - Check address patterns by state, locality, street type
   - Identify data quality issues

3. **Validate Migration**
   - Compare document counts (15,733,809 expected)
   - Spot-check address formatting
   - Test search relevance with sample queries

## Key Statistics

### Database
- **Total Addresses:** 15,733,809
- **Database Size:** 1.6 GB
- **Tables:** 8 (core + reference)

### Address Components
- **With Street Numbers:** 87% (13.7M)
- **With Units:** 24% (3.8M)
- **With Floors:** 0.5% (80K)
- **With Building Names:** 1% (152K)
- **PO Box Addresses:** 13% (~2M)

### Localities
- **Total Localities:** 15,794
- **States:** 8 (ACT, NSW, NT, QLD, SA, TAS, VIC, WA)
- **Unique Postcodes:** ~3,000

### Streets
- **Street Groups:** 516,479
- **Unique Street Types:** 147
- **Most Common:** ST (134K), RD (132K), CT (47K)

### OpenSearch Index
- **Estimated Size:** 27.5 GB (primary), 55 GB (with replica)
- **Documents:** 15,733,809
- **Shards:** 5 primary, 5 replica
- **Fields per Document:** ~30 fields
- **Average Document Size:** ~1.75 KB

## Performance Targets

### Migration
- **Batch Size:** 10,000 documents
- **Indexing Rate:** ~2,000 docs/second
- **Total Time:** 3-4 hours

### Autocomplete Queries
- **Target Latency:** < 100ms (p95)
- **Throughput:** 100 requests/second
- **Result Size:** 10 addresses per query

### Cluster
- **Search Latency:** < 50ms (p99)
- **Index Refresh:** 30 seconds
- **Availability:** 99.9% (multi-AZ with replica)

## Implementation Timeline

### Week 1: Index Setup
- Provision OpenSearch cluster
- Create index with mappings
- Test with sample data

### Week 2: Data Migration
- Build ETL Lambda function
- Execute migration (3-4 hours)
- Validate data quality

### Week 3: Integration
- Update autocomplete Lambda handler
- API Gateway integration
- Load testing

### Week 4: Optimization
- Performance tuning
- Monitoring and alerting
- Documentation and handoff

## Related Files

**Project Root:**
- [README.md](../README.md) - Main project documentation
- [intent-statement.md](../intent-statement.md) - Project objectives

**Lambda Functions:**
- `lambda/paf-autocomplete/` - PAF autocomplete handler
- `lambda/aws-location/` - AWS Location Service handler

**Infrastructure:**
- `lib/` - CDK stack definitions
- `bin/` - CDK app entry point

## Support

For questions or issues:
1. Review the comprehensive design document (RAS-14)
2. Check the quick reference guide
3. Consult sample documents and queries
4. Contact the development team

---

**Last Updated:** 2026-02-05
**Version:** 1.0
**Status:** Design Complete - Ready for Implementation
