import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = await headers();
  // Try to get IP from various headers (standard for proxies/Vercel)
  const ip = headersList.get('x-forwarded-for') || 
            headersList.get('x-real-ip') || 
            '127.0.0.1'; // Fallback for local dev if not found

  // If x-forwarded-for contains multiple IPs, take the first one
  const clientIp = ip.split(',')[0].trim();

  return NextResponse.json({ ip: clientIp });
}
