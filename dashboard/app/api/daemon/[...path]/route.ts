import { NextRequest, NextResponse } from 'next/server';

/**
 * RALPH Loop: Handle/Execute
 * Hardened SNS Daemon Proxy with Dynamic Node Targeting.
 * Allows connection to local nodes (e.g. localhost:8080) from Vercel.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  
  // 1. Dynamic Node URL Extraction
  // Checks X-SNS-Node-URL header (injected by secureFetch) or defaults to production
  const customNodeUrl = request.headers.get('x-sns-node-url');
  const nodeUrl = customNodeUrl || process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
  
  const targetUrl = `${nodeUrl}/${path}${request.nextUrl.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      // Logic: Return the exact status code to help UI show specific offline state
      return NextResponse.json(
        { error: `Daemon responded with ${response.status}`, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Logic: Standardize on 502 for connection failures
    return NextResponse.json(
      { error: 'Failed to connect to SNS daemon (Node Offline)', status: 502 },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  
  const customNodeUrl = request.headers.get('x-sns-node-url');
  const nodeUrl = customNodeUrl || process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
  
  const targetUrl = `${nodeUrl}/${path}${request.nextUrl.search}`;

  try {
    const body = await request.json();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Daemon responded with ${response.status}`, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to SNS daemon (Node Offline)', status: 502 },
      { status: 502 }
    );
  }
}
