# Rapid Address Service POC

A proof-of-concept address autocomplete service built on AWS using serverless architecture. This project provides a comparison between PAF (Postcode Address File) and AWS Location Service for address autocomplete functionality.

## Architecture

The infrastructure is built using AWS CDK (TypeScript) and includes:

- **Lambda Functions** (Node.js 20.x)
  - PAF Autocomplete Handler
  - AWS Location Service Handler
- **API Gateway** (REST API)
  - `/autocomplete/paf` - PAF autocomplete endpoint
  - `/autocomplete/location` - AWS Location Service endpoint
- **Frontend Hosting**
  - S3 bucket for static assets
  - CloudFront distribution with HTTPS
  - SPA routing support

## Project Structure

```
rapid-address-service-poc/
├── bin/
│   └── rapid-address-service-poc.ts    # CDK app entry point
├── lib/
│   ├── rapid-address-service-stack.ts  # Main stack definition
│   └── constructs/
│       ├── frontend-construct.ts       # S3 + CloudFront
│       ├── api-construct.ts            # API Gateway
│       └── lambda-construct.ts         # Lambda functions
├── lambda/
│   ├── paf-autocomplete/
│   │   ├── index.ts                    # PAF handler
│   │   └── package.json
│   └── aws-location/
│       ├── index.ts                    # AWS Location handler
│       └── package.json
├── test/
│   └── rapid-address-service.test.ts   # Stack unit tests
├── cdk.json                            # CDK configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Project dependencies
```

## Prerequisites

- Node.js 20.x or later
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS account with appropriate permissions

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd rapid-address-service-poc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Testing

Run the unit tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm test -- --coverage
```

## Deployment

### First-time Setup

1. Bootstrap your AWS environment (one-time per account/region):
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/ap-southeast-2
   ```

### Deploy the Stack

1. Synthesize the CloudFormation template:
   ```bash
   npm run synth
   ```

2. Review the changes that will be deployed:
   ```bash
   npm run diff
   ```

3. Deploy the stack:
   ```bash
   npm run deploy
   ```

   Or deploy to a specific environment:
   ```bash
   cdk deploy -c environment=dev
   cdk deploy -c environment=prod
   ```

4. Note the outputs after deployment:
   - `CloudFrontDomainName` - Frontend URL
   - `ApiEndpoint` - API Gateway base URL
   - `PafAutocompleteEndpoint` - PAF endpoint
   - `AwsLocationAutocompleteEndpoint` - AWS Location endpoint
   - `FrontendBucketName` - S3 bucket for frontend assets

### Deploy Frontend Assets

After deploying the infrastructure, upload your frontend build to S3:

```bash
# Build your frontend application first
# cd frontend && npm run build

# Upload to S3
aws s3 sync ./frontend/build s3://$(aws cloudformation describe-stacks \
  --stack-name rapid-address-dev-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text) --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(aws cloudformation describe-stacks \
    --stack-name rapid-address-dev-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text) \
  --paths "/*"
```

## API Endpoints

### PAF Autocomplete

```bash
GET /autocomplete/paf?query=<search-term>&limit=<number>
```

**Parameters:**
- `query` (required): Search term for address lookup
- `limit` (optional): Maximum number of results (default: 10)

**Example:**
```bash
curl "https://api-endpoint.execute-api.ap-southeast-2.amazonaws.com/dev/autocomplete/paf?query=george&limit=5"
```

**Response:**
```json
{
  "query": "george",
  "results": [
    {
      "id": "1",
      "address": "george Street, Sydney NSW 2000",
      "formattedAddress": "george Street, Sydney, New South Wales, 2000",
      "postcode": "2000",
      "state": "NSW",
      "suburb": "Sydney",
      "confidence": 0.95
    }
  ],
  "count": 1,
  "source": "PAF"
}
```

### AWS Location Service Autocomplete

```bash
GET /autocomplete/location?query=<search-term>&limit=<number>&biasPosition=<lng,lat>
```

**Parameters:**
- `query` (required): Search term for address lookup
- `limit` (optional): Maximum number of results (default: 10)
- `biasPosition` (optional): Bias results toward location (format: "lng,lat")

**Example:**
```bash
curl "https://api-endpoint.execute-api.ap-southeast-2.amazonaws.com/dev/autocomplete/location?query=george&limit=5"
```

**Response:**
```json
{
  "query": "george",
  "results": [
    {
      "id": "place-1",
      "text": "george Street",
      "placeName": "george Street, Sydney, New South Wales, 2000, Australia",
      "region": "New South Wales",
      "municipality": "Sydney",
      "postalCode": "2000",
      "country": "AUS",
      "geometry": {
        "point": [151.2093, -33.8688]
      },
      "relevance": 0.92
    }
  ],
  "count": 1,
  "source": "AWSLocation",
  "biasPosition": null
}
```

## Configuration

### Environment Variables

Configure the environment by passing context to CDK:

```bash
cdk deploy -c environment=dev
cdk deploy -c environment=staging
cdk deploy -c environment=prod
```

### Lambda Configuration

Lambda functions are configured with:
- Runtime: Node.js 20.x
- Memory: 256 MB
- Timeout: 30 seconds
- Log retention: 7 days

To modify these settings, edit `lib/constructs/lambda-construct.ts`.

### API Gateway Configuration

API Gateway is configured with:
- Stage: Based on environment
- Throttling: 100 requests/second, burst 200
- CORS: Enabled for all origins (POC only)
- Logging: Full request/response logging

To modify these settings, edit `lib/constructs/api-construct.ts`.

## Monitoring

### CloudWatch Logs

Lambda function logs are available in CloudWatch:

```bash
# PAF function logs
aws logs tail /aws/lambda/rapid-address-dev-paf-autocomplete --follow

# AWS Location function logs
aws logs tail /aws/lambda/rapid-address-dev-aws-location-autocomplete --follow

# API Gateway logs
aws logs tail /aws/apigateway/rapid-address-dev --follow
```

### CloudWatch Metrics

Monitor API Gateway metrics:
- Request count
- Latency (4xx, 5xx errors)
- Integration latency

Monitor Lambda metrics:
- Invocations
- Duration
- Error count
- Throttles

## Cost Optimization

This POC is designed to minimize costs:

- Lambda: Pay per request (includes 1M free requests/month)
- API Gateway: Pay per request (includes 1M free requests/month for first 12 months)
- S3: Minimal storage costs
- CloudFront: Pay per request and data transfer
- CloudWatch Logs: 7-day retention to reduce costs

**Estimated Monthly Cost (light usage):**
- Lambda: ~$0.20 (1,000 requests/month)
- API Gateway: ~$3.50 (1M requests/month)
- S3: ~$0.50 (10 GB storage)
- CloudFront: ~$1.00 (1 GB transfer)
- **Total: ~$5-10/month** (excluding free tier)

## Security

### Current Implementation (POC)

- CORS enabled for all origins (for testing)
- No authentication/authorization
- Public API endpoints
- CloudFront HTTPS enforced
- S3 bucket access via CloudFront only (OAC)

### Production Recommendations

Before production deployment:

1. Add authentication (API Gateway authorizers, Cognito)
2. Restrict CORS to specific origins
3. Add rate limiting per user/API key
4. Enable AWS WAF for API Gateway
5. Add request validation
6. Implement CloudWatch alarms
7. Enable AWS X-Ray for tracing
8. Add secrets management for API keys
9. Implement backup strategy
10. Set up proper logging and monitoring

## Troubleshooting

### Deployment Issues

**Issue: CDK bootstrap not found**
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

**Issue: Lambda function deployment fails**
- Ensure Lambda code is valid TypeScript
- Check for missing dependencies in package.json
- Verify Node.js runtime version

**Issue: CloudFront distribution takes time to deploy**
- CloudFront distributions can take 10-15 minutes to deploy
- This is normal AWS behavior

### Runtime Issues

**Issue: CORS errors in browser**
- Verify API Gateway CORS configuration
- Check response headers in Lambda functions
- Ensure OPTIONS method is configured

**Issue: 403 from CloudFront**
- Check S3 bucket policy
- Verify CloudFront Origin Access Control
- Ensure index.html exists in S3

**Issue: API Gateway 5xx errors**
- Check Lambda function logs in CloudWatch
- Verify Lambda execution role permissions
- Check Lambda timeout settings

## Cleanup

To avoid ongoing charges, destroy the stack:

```bash
npm run destroy
```

Or:

```bash
cdk destroy
```

This will delete all resources except:
- CloudWatch Logs (retained by default)
- S3 bucket may require manual deletion if versioning enabled

## Development

### Building

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

### Synthesizing CloudFormation

```bash
npm run synth
```

### Linting

```bash
npm run lint
```

## Next Steps

1. **Integrate Real PAF Provider**
   - Replace mock data with actual PAF API integration
   - Add API key management
   - Implement caching strategy

2. **Implement AWS Location Service**
   - Create Place Index
   - Configure SearchPlaceIndexForSuggestions
   - Add IAM permissions

3. **Build Frontend Application**
   - React/Vue/Angular SPA
   - Address autocomplete UI component
   - Side-by-side comparison interface

4. **Add Performance Testing**
   - Load testing with Artillery/k6
   - Measure latency differences
   - Cost comparison analysis

5. **Implement Caching**
   - ElastiCache for Redis
   - Lambda@Edge for CloudFront
   - API Gateway caching

## License

This is a proof-of-concept project.

## Support

For issues and questions, please contact the development team.

---

Built with AWS CDK and deployed to AWS ap-southeast-2 region.
