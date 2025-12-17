
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import FileTransfer from '../../../../models/FileTransfer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...data } = body;
        
        await dbConnect();

        if (action === 'create') {
            const transfer = await FileTransfer.create(data);
            return NextResponse.json(transfer);
        } 
        else if (action === 'update') {
            const { id, status, s3Key } = data;
            const update: any = { status };
            if (s3Key) update.s3Key = s3Key;
            
            const transfer = await FileTransfer.findByIdAndUpdate(id, update, { new: true });
            return NextResponse.json(transfer);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const room = searchParams.get('room');
        const user = searchParams.get('user'); // Can be sender or recipient
        
        if (!room || !user) {
             return NextResponse.json({ error: 'Missing room or user' }, { status: 400 });
        }

        await dbConnect();

        // Find active transfers for this user in this room
        const transfers = await FileTransfer.find({
            room,
            $or: [{ sender: user }, { recipient: user }],
            status: { $in: ['pending', 'accepted', 'uploading', 'uploaded'] } // Only active ones
        }).sort({ createdAt: -1 });

        return NextResponse.json(transfers);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
