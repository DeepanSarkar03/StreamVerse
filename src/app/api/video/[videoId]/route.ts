import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

async function getAzureUrl(blobName: string): Promise<string | null> {
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
        
        // This relies on the blob container having public access enabled.
        // The upload action attempts to set this on container creation.
        const exists = await blockBlobClient.exists();
        if (!exists) {
            return null;
        }

        return blockBlobClient.url;
    } catch (e) {
        console.error("Failed to get Azure blob URL", e);
        return null;
    }
}


export async function GET(request: Request, { params }: { params: { videoId: string } }) {
  const { videoId } = params; // videoId is the URL-decoded blob name

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid video ID format.' }, { status: 400 });
  }

  try {
    const url = await getAzureUrl(videoId);

    if (!url) {
        return NextResponse.json({ error: `Could not retrieve video URL from Azure. The file may not be accessible or the container's public access level may be incorrect.` }, { status: 404 });
    }

    // Redirect the client directly to the streamable URL.
    return NextResponse.redirect(url, { status: 302 });

  } catch (error)
  {
    console.error(`Error fetching video URL for ${videoId}:`, error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
