import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// In-memory storage for pending uploads
const pendingUploads = new Map<string, {
  blockIds: string[];
  containerClient: any;
  blockBlobClient: any;
  fileName: string;
  contentType: string;
  uploadedSize: number;
  totalSize: number;
  startTime: number;
}>();

// Initialize a chunked upload session
export async function POST(request: NextRequest) {
  try {
    const { action, uploadId, fileName, contentType, totalSize, chunk, blockIndex, blockId } = await request.json();

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!connectionString || !containerName) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    if (action === 'init') {
      // Initialize upload session
      const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const blockBlobClient = containerClient.getBlockBlobClient(sanitizedFileName);

      pendingUploads.set(id, {
        blockIds: [],
        containerClient,
        blockBlobClient,
        fileName: sanitizedFileName,
        contentType: contentType || 'video/mp4',
        uploadedSize: 0,
        totalSize: totalSize || 0,
        startTime: Date.now(),
      });

      return NextResponse.json({ uploadId: id, fileName: sanitizedFileName });
    }

    if (action === 'chunk') {
      const upload = pendingUploads.get(uploadId);
      if (!upload) {
        return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
      }

      // Decode base64 chunk
      const chunkBuffer = Buffer.from(chunk, 'base64');
      
      // Stage the block
      await upload.blockBlobClient.stageBlock(blockId, chunkBuffer, chunkBuffer.length);
      upload.blockIds.push(blockId);
      upload.uploadedSize += chunkBuffer.length;

      const progress = upload.totalSize > 0 
        ? Math.round((upload.uploadedSize / upload.totalSize) * 100) 
        : 0;
      
      const elapsed = (Date.now() - upload.startTime) / 1000;
      const speed = elapsed > 0 ? (upload.uploadedSize / (1024 * 1024)) / elapsed : 0;

      return NextResponse.json({ 
        success: true, 
        uploadedSize: upload.uploadedSize,
        progress,
        speed: speed.toFixed(1),
      });
    }

    if (action === 'complete') {
      const upload = pendingUploads.get(uploadId);
      if (!upload) {
        return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
      }

      // Commit all blocks
      await upload.blockBlobClient.commitBlockList(upload.blockIds, {
        blobHTTPHeaders: {
          blobContentType: upload.contentType.startsWith('video/') ? upload.contentType : 'video/mp4',
        },
      });

      const elapsed = (Date.now() - upload.startTime) / 1000;
      const avgSpeed = elapsed > 0 ? (upload.uploadedSize / (1024 * 1024)) / elapsed : 0;

      pendingUploads.delete(uploadId);

      return NextResponse.json({ 
        success: true, 
        fileName: upload.fileName,
        totalSize: upload.uploadedSize,
        avgSpeed: avgSpeed.toFixed(1),
      });
    }

    if (action === 'abort') {
      pendingUploads.delete(uploadId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Upload chunk error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
