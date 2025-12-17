
import { NextResponse } from 'next/server';
import { s3Client } from '../../../../../lib/s3';
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, fileName, fileType, key } = body;
        
        const bucketName = process.env.AWS_BUCKET_NAME;
        if (!bucketName) {
            throw new Error("AWS_BUCKET_NAME is not defined");
        }

        if (action === 'upload') {
            if (!fileName || !fileType) {
                 return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 });
            }

            // Create a unique key (folder/timestamp-filename)
            const objectKey = `uploads/${Date.now()}-${fileName}`;
            
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                ContentType: fileType || 'application/octet-stream',
                // Explicitly disable checksum algorithm in the command if SDK tries to add it
                ChecksumAlgorithm: undefined, 
            });

            // Pass signableHeaders to ensure content-type is signed if we want strictness, 
            // but usually removing checksums is key.
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

            return NextResponse.json({ url, key: objectKey });

        } else if (action === 'download') {
            if (!key) {
                return NextResponse.json({ error: 'Missing key' }, { status: 400 });
            }

            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

            return NextResponse.json({ url });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        console.error("S3 Sign Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
