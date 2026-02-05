# Rapid Addressing Service
## Summary
We want to do a POC using AWS Serverless architecture and CDK to build frontend and backend for rapid addressing. Main purpose of this is to provide business users perspective of using existing Australia POST PAF file vs using AWS Location service of auto-complete, address look up have different cost benefits, functional benefits etc. For this project - PAF is pushed into SQLLite datbaase which is available at the start of the project and data model will be extracted so that relavtive index can be created in OpenSearch Serverless. We should provide Intiutive UI deep analysis after each auto-complete request.
## Problem Statement
Currently, our business users rely on the Australia POST PAF file for address validation but that's a batch process but now we need to provide rapid addressing service for realtime auto-complete feature.
## Goals
1. Build a POC using AWS Serverless architecture and CDK for rapid addressing service.
2. Compare the cost and functional benefits of using AWS Location service vs using Australia POST PAF
3. Provide an intuitive UI for auto-complete feature and deep analysis after each request.
4. Provide capability to use AWS Location service as well as build new service which leverages PAF exported data in OpenSeach building OpenSearch index will be part of backend development which should eventually provide an endpoint for UI to integrate to.
## Non-Goals
1. This POC will not cover the entire address validation process but will focus on the auto-complete
2. This POC will not cover the integration with other systems or services.
## Success Metrics
1. Successful implementation of the POC using AWS Serverless architecture and CDK.
2. Clear comparison of cost and functional benefits between AWS Location service and Australia POST PAF.
3. Positive feedback from business users on the intuitive UI and deep analysis provided after each auto-com
plete request.
4. Successful integration of AWS Location service and the new service leveraging PAF data in OpenSearch
## Stakeholders
1. Business Users: They will be the primary users of the rapid addressing service and will provide
feedback on the UI and functionality.
2. Development Team: They will be responsible for building the POC and implementing the backend and
frontend components.
3. AWS Services Team: They will provide support and guidance on using AWS services for the P
OC.
4. SQLLite file is available not PAF.