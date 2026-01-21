import { NextRequest, NextResponse } from 'next/server';

const PROXY_VM_URL = process.env.PROXY_VM_URL || 'http://4.213.170.162:3000';
const PROXY_VM_SECRET = process.env.PROXY_VM_SECRET || 'df81ea76-37a1-4d00-aa08-24cb2ae56328';

// POST - Start a turbo download
export async function POST(request: NextRequest) {
  try {
    const { url, fileName, accessToken, cookies } = await request.json();

    if (!url || !fileName) {
      return NextResponse.json({ error: 'url and fileName are required' }, { status: 400 });
    }

    // Start download job on proxy VM
    const response = await fetch(`${PROXY_VM_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        fileName,
        secret: PROXY_VM_SECRET,
        accessToken: accessToken || '',  // Google OAuth access token
        cookies: cookies || '',           // Fallback for cookies if needed
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Turbo download error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start turbo download' }, { status: 500 });
  }
}

// GET - Check job status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const response = await fetch(`${PROXY_VM_URL}/status/${jobId}?secret=${PROXY_VM_SECRET}`);
    
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get status' }, { status: 500 });
  }
}
