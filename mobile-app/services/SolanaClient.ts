import { NativeModules } from 'react-native';

const { SolnetNative } = NativeModules;

export interface NativeKeypair {
  publicKey: string;
  secretKey: string;
}

export class SolanaClient {
  private rpcUrl: string;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Generates a keypair using the NATIVE (Rust) engine.
   * Secure, stable, and fast.
   */
  async generateKeypair(): Promise<NativeKeypair> {
    if (!SolnetNative) throw new Error('Native module SolnetNative not found');
    const result = await SolnetNative.generateKeypair();
    return JSON.parse(result);
  }

  /**
   * Minimalist RPC fetcher.
   * No heavy dependencies, 100% stable.
   */
  async getBalance(publicKey: string): Promise<number> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [publicKey],
        }),
      });

      const { result } = await response.json();
      return result?.value || 0;
    } catch (err) {
      console.error('SolanaClient.getBalance failed:', err);
      return 0;
    }
  }

  /**
   * Proxy for native transaction signing.
   */
  async signMessage(secretKey: string, message: string): Promise<string> {
    if (!SolnetNative) throw new Error('Native module SolnetNative not found');
    return await SolnetNative.signTransaction(secretKey, message);
  }
}

export const solanaClient = new SolanaClient();
