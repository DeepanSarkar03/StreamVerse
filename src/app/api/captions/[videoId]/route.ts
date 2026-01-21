import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

// Get captions for a video (checks if .vtt file exists in Azure)
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid video ID.' }, { status: 400 });
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return NextResponse.json({ error: 'Azure Storage not configured.' }, { status: 500 });
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Caption file has same name but .vtt extension
    const captionFileName = videoId.replace(/\.(mp4|mkv|mov|avi|webm)$/i, '.vtt');
    const blobClient = containerClient.getBlockBlobClient(captionFileName);
    
    const exists = await blobClient.exists();
    
    if (!exists) {
      return NextResponse.json({ 
        exists: false, 
        message: 'No captions available for this video.' 
      }, { status: 404 });
    }

    // Stream the VTT file
    const downloadResponse = await blobClient.download(0);
    
    if (!downloadResponse.readableStreamBody) {
      return NextResponse.json({ error: 'Failed to read caption file.' }, { status: 500 });
    }

    // Read the stream into a string
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const vttContent = Buffer.concat(chunks).toString('utf-8');

    return new Response(vttContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error fetching captions:', error);
    return NextResponse.json({ error: 'Failed to fetch captions.' }, { status: 500 });
  }
}
