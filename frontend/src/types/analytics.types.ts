export interface AnalyticsEntry {
  timestamp: number;
  query: string;
  pafLatency: number;
  awsLatency: number;
  pafResultCount: number;
  awsResultCount: number;
  awsCost: number;
}
