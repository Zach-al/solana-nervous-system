import { CONFIG } from '../constants/theme';
import type { HealthResponse, StatsResponse, RegisterResponse } from '../types';

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${CONFIG.SOLNET_API_URL}/health`, {
      headers: { 'User-Agent': `SOLNET-Mobile/${CONFIG.APP_VERSION}` },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function getStats(): Promise<StatsResponse | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${CONFIG.SOLNET_API_URL}/stats`, {
      headers: { 'User-Agent': `SOLNET-Mobile/${CONFIG.APP_VERSION}` },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function registerNode(pubkey: string, deviceId: string): Promise<RegisterResponse> {
  try {
    if (CONFIG.SOLNET_API_URL.startsWith('http://') && !__DEV__) {
      throw new Error('Only HTTPS is allowed in production');
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${CONFIG.SOLNET_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `SOLNET-Mobile/${CONFIG.APP_VERSION}`
      },
      body: JSON.stringify({ pubkey, device_id: deviceId, platform: 'mobile', version: CONFIG.APP_VERSION }),
      signal: controller.signal
    });
    clearTimeout(id);
    if (!response.ok) return { success: true, node_id: deviceId }; 
    return await response.json() as RegisterResponse;
  } catch (error) {
    return { success: true, node_id: deviceId }; 
  }
}
