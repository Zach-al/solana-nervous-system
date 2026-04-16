/**
 * Hardened fetch wrapper for all outbound requests from the dashboard.
 *
 * Features:
 * - 10-second request timeout (prevents hanging requests)
 * - Domain allow-list (only Railway and localhost allowed)
 * - Response size limit (1 MB)
 * - Automatic Content-Type: application/json header
 */

const TIMEOUT_MS = 10_000
const MAX_RESPONSE_SIZE = 1024 * 1024 // 1 MB

const ALLOWED_DOMAINS = ['localhost', 'railway.app', 'up.railway.app']

function isDomainAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // ── Unified Proxy Support ──────────────────────────────
  const isLocalProxy = url.startsWith('/api/daemon');

  // ── Domain allow-list ─────────────────────────────────────
  if (!isLocalProxy && !isDomainAllowed(url)) {
    const { hostname } = new URL(url);
    throw new Error(`SOLNET: domain not allowed: ${hostname}`);
  }

  // ── Abort controller for timeout ─────────────────────────
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // ── Local Node Injection ──────────────────────────────
    let customNodeUrl = '';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      customNodeUrl = params.get('node') || '';
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(customNodeUrl ? { 'X-SNS-Node-URL': customNodeUrl } : {}),
        ...options.headers,
      },
    })

    // ── Response size check ───────────────────────────────
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error('SOLNET: response too large (> 1 MB)')
    }

    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
