import { NextResponse } from 'next/server';
import type { Video } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { BlobServiceClient } from '@azure/storage-blob';

interface AzureProviderResult {
  videos: Video[];
  error: string | null;
}

const validVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm'];
const placeholderThumbnail = PlaceHolderImages.find(p => p.id === 'video-thumbnail')?.imageUrl || 'https://picsum.photos/seed/streamverse-thumb/400/225';

async function getAzureVideos(): Promise<AzureProviderResult> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return { videos: [], error: "Azure Blob Storage is not configured in .env.local." };
  }
  
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Get the base URL for the container
    const containerUrl = containerClient.url;
    
    const videos: Video[] = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      if (validVideoExtensions.some(ext => blob.name.toLowerCase().endsWith(ext))) {
        // Create direct URL to the blob (works if container has public access)
        const directUrl = `${containerUrl}/${encodeURIComponent(blob.name).replace(/%2F/g, '/')}`;
        
        videos.push({
          id: blob.name, // The id is the blob name
          title: blob.name.replace(/\.[^/.]+$/, ""),
          thumbnail: placeholderThumbnail,
          source: 'azure',
          streamUrl: directUrl, // Direct Azure URL for streaming
        });
      }
    }
    
    return { videos, error: null };

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error fetching from Azure Blob Storage:", message);
    return { videos: [], error: `Azure: ${message}` };
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const azureResult = await getAzureVideos();

  const allVideos = [...azureResult.videos];
  const allErrors = [azureResult.error].filter((e): e is string => e !== null);
    
  allVideos.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ videos: allVideos, errors: allErrors });
}
