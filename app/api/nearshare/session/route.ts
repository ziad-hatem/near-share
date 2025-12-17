
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import ActiveSession from '../../../../models/ActiveSession';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { socketId, networkHash, displayName, fingerprint } = body;

        await dbConnect();

        const session = await ActiveSession.findOneAndUpdate(
            { socketId },
            { 
                socketId, 
                networkHash, 
                displayName, 
                fingerprint: fingerprint || 'unknown',
                lastActive: new Date()
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, session });
    } catch (e: any) {
        console.error("Session API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
