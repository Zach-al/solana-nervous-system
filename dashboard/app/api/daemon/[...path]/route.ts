import { NextRequest, NextResponse } from 'next/server';

/**
 * RALPH Loop: Handle/Execute
 * Next.js 16/15 Route Handler for SNS Daemon Proxying. 
 * Resolves async params according to App Router specifications.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Logic: Await params to comply with Next.js dynamic routing types
  const resolvedParams = await params;
  const pathParts = resolvedParams.path;
  const path = pathParts.join('/');
  
  const nodeUrl = process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
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
      console.warn(`[API_PROXY] Daemon error for ${path}: ${response.status}`);
      return NextResponse.json(
        { error: `Daemon responded with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API_PROXY] Connection failure for ${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to connect to SNS daemon' },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Logic: Await params to comply with Next.js dynamic routing types
  const resolvedParams = await params;
  const pathParts = resolvedParams.path;
  const path = pathParts.join('/');
  
  const nodeUrl = process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
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
      console.warn(`[API_PROXY] Daemon POST error for ${path}: ${response.status}`);
      return NextResponse.json(
        { error: `Daemon responded with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API_PROXY] Connection failure for POST ${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to connect to SNS daemon' },
      { status: 502 }
    );
  }
}
