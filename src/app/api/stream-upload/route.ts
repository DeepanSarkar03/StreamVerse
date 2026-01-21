import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// In-memory storage for pending uploads (use Redis in production)
const pendingUploads = new Map<string, {
  blockIds: string[];
  blockBlobClient: any;
  fileName: string;
  contentType: string;
  uploadedSize: number;
  totalSize: number;
  startTime: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, uploadId, fileName, contentType, totalSize, blockId, chunk } = body;

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!connectionString || !containerName) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    if (action === 'init') {
      await containerClient.createIfNotExists();
      
      const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!sanitizedFileName.match(/\.\w{2,5}$/)) {
        sanitizedFileName += '.mp4';
      }
      
      const blockBlobClient = containerClient.getBlockBlobClient(sanitizedFileName);

      pendingUploads.set(id, {
        blockIds: [],
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
      
      // Stage the block (this uploads to Azure at full speed)
      await upload.blockBlobClient.stageBlock(blockId, chunkBuffer, chunkBuffer.length);
      
      // Track block ID for final commit (must maintain order)
      const blockIndex = parseInt(atob(blockId), 10);
      upload.blockIds[blockIndex] = blockId;
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

      // Filter out undefined entries and commit
      const validBlockIds = upload.blockIds.filter(id => id !== undefined);
      
      await upload.blockBlobClient.commitBlockList(validBlockIds, {
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
    console.error('Stream upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Increase body size limit for chunks
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16mb',
    },
  },
};
