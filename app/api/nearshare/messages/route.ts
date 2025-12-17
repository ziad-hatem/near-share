
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Message from '../../../../models/Message';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { room, sender, recipient, type, content } = body;

        if (!room || !sender || !recipient || !type || !content) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        await dbConnect();

        const message = await Message.create({
            room,
            sender,
            recipient,
            type,
            content,
            timestamp: Date.now()
        });

        return NextResponse.json({ success: true, id: message._id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const room = searchParams.get('room');
        const recipient = searchParams.get('recipient');
        const since = searchParams.get('since');

        if (!room || !recipient) {
            return NextResponse.json({ error: 'Missing room or recipient' }, { status: 400 });
        }

        await dbConnect();

        const query: any = {
            room,
            recipient: { $in: [recipient, 'all'] }, // Get private + broadcast messages
        };

        if (since) {
            query.timestamp = { $gt: Number(since) };
        }

        // Limit to last 50 to prevent overflow on initial load
        const messages = await Message.find(query).sort({ timestamp: 1 }).limit(50);

        return NextResponse.json(messages);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
