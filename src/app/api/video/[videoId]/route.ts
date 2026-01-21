import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

async function getBlobClient(blobName: string) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    if (!connectionString || !containerName) {
        console.error("Azure Storage environment variables are not set.");
        return null;
    }
    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        const exists = await blockBlobClient.exists();
        if (!exists) {
            return null;
        }

        return blockBlobClient;
    } catch (e) {
        console.error("Failed to get Azure blob client", e);
        return null;
    }
}

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId: rawVideoId } = await params;

  if (!rawVideoId) {
    return NextResponse.json({ error: 'Invalid video ID format.' }, { status: 400 });
  }

  // Try to decode the videoId - it might be double-encoded
  let videoId = rawVideoId;
  try {
    // First decode (Next.js already decodes once)
    const decoded = decodeURIComponent(rawVideoId);
    // Check if it was double-encoded by trying to decode again
    try {
      const doubleDecoded = decodeURIComponent(decoded);
      // If double decoding works and gives different result, use it
      if (doubleDecoded !== decoded) {
        videoId = doubleDecoded;
      } else {
        videoId = decoded;
      }
    } catch {
      videoId = decoded;
    }
  } catch {
    // If decoding fails, use the raw value
    videoId = rawVideoId;
  }

  console.log(`Video request for: "${videoId}" (raw: "${rawVideoId}")`);

  try {
    // Try with the decoded videoId first
    let blobClient = await getBlobClient(videoId);
    
    // If not found, try with the raw videoId
    if (!blobClient && videoId !== rawVideoId) {
      console.log(`Trying raw videoId: "${rawVideoId}"`);
      blobClient = await getBlobClient(rawVideoId);
    }

    if (!blobClient) {
        console.error(`Video not found in Azure: "${videoId}"`);
        return NextResponse.json({ error: `Could not find video in Azure Storage.` }, { status: 404 });
    }

    // Get blob properties for content-type and size
    const properties = await blobClient.getProperties();
    const contentType = properties.contentType || 'video/mp4';
    const contentLength = properties.contentLength || 0;

    // Parse range header for video seeking support
    const rangeHeader = request.headers.get('range');
    
    if (rangeHeader) {
      // Handle range request for video seeking
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        // Use larger chunks for smoother streaming (10MB chunks or to end of file)
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for smooth playback
        const requestedEnd = match[2] ? parseInt(match[2], 10) : null;
        const end = requestedEnd !== null 
          ? Math.min(requestedEnd, contentLength - 1)
          : Math.min(start + CHUNK_SIZE - 1, contentLength - 1);
        const chunkSize = end - start + 1;

        const downloadResponse = await blobClient.download(start, chunkSize);
        
        if (!downloadResponse.readableStreamBody) {
          return NextResponse.json({ error: 'Failed to get video stream.' }, { status: 500 });
        }

        // Convert Node.js stream to Web ReadableStream with high watermark for buffering
        const nodeStream = downloadResponse.readableStreamBody as NodeJS.ReadableStream;
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          }
        });

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${contentLength}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    // Full file download (no range request)
    const downloadResponse = await blobClient.download(0);
    
    if (!downloadResponse.readableStreamBody) {
      return NextResponse.json({ error: 'Failed to get video stream.' }, { status: 500 });
    }

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      async start(controller) {
        const reader = downloadResponse.readableStreamBody as NodeJS.ReadableStream;
        reader.on('data', (chunk) => controller.enqueue(chunk));
        reader.on('end', () => controller.close());
        reader.on('error', (err) => controller.error(err));
      }
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error(`Error streaming video ${videoId}:`, error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
