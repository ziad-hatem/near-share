
import dbConnect from '../../../../lib/db';
import ActiveSession from '../../../../models/ActiveSession';
import Room from '../../../../models/Room';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get('room');

  if (!roomName) return NextResponse.json([], { status: 400 });

  await dbConnect();

  // Check if room exists (strict mode)
  const room = await Room.findOne({ name: roomName });
  if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const users = await ActiveSession.find({ networkHash: roomName });
  return NextResponse.json({ users, hasPassword: !!room.password });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, name, password } = body;
        
        await dbConnect();

        if (action === 'create') {
            const existing = await Room.findOne({ name });
            if (existing) {
                return NextResponse.json({ error: 'Room already exists' }, { status: 409 });
            }
            // Sanitize: Convert empty empty string to undefined so optional validator works
            const payload: any = { name };
            if (password && password.trim().length > 0) {
                 payload.password = password;
            }
            await Room.create(payload);
            return NextResponse.json({ success: true, name });
        }
        
        if (action === 'join') {
            const room = await Room.findOne({ name });
            if (!room) {
                 return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            }
            if (room.password && room.password !== password) {
                 return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
            }
            return NextResponse.json({ success: true, name });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (e: any) {
        console.error("Room API Error:", e);
        return NextResponse.json({ error: 'Server error', details: e.message }, { status: 500 });
    }
}
