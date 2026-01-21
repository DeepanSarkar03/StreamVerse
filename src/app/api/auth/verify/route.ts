import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    const correctPin = process.env.APP_PIN;

    if (!correctPin) {
      // If no PIN is configured, allow access (for development)
      console.warn('APP_PIN environment variable is not set. Authentication is disabled.');
      return NextResponse.json({ success: true });
    }

    const isValid = pin === correctPin;

    return NextResponse.json({ success: isValid });
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
