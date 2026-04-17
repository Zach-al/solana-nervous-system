export interface HealthResponse {
  status: string;
  version: string;
  mode?: string;
  node_id?: string;
  requests_served?: number;
  earnings_lamports?: number;
  uptime_seconds?: number;
}

export interface StatsResponse {
  peer_count: number;
  requests_per_minute: number;
  cache_hit_rate: number;
}

export interface RegisterResponse {
  success: boolean;
  node_id: string;
}

export interface EarningEntry {
  timestamp: string;
  lamports: number;
  requests: number;
}
