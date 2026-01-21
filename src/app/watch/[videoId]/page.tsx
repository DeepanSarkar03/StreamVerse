import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { NetflixPlayer } from '@/components/netflix-player';
import { BlobServiceClient } from '@azure/storage-blob';

function getTitleFromId(videoId: string): string {
  try {
    // The videoId is now the blob name. We just remove the extension.
    const cleanedTitle = videoId.replace(/\.(mp4|mkv|mov|avi|webm)$/i, '');
    return decodeURIComponent(cleanedTitle);
  } catch {
    return "Video";
  }
}

function getThumbnail(videoId: string): string {
  // Generate a placeholder thumbnail based on video ID
  const seed = videoId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'default';
  return `https://picsum.photos/seed/${seed}/400/225`;
}

// Get direct Azure blob URL for maximum streaming performance
async function getDirectStreamUrl(videoId: string): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return null;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(videoId);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      return null;
    }

    // Return the direct URL (works with public container access)
    return blobClient.url;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const title = getTitleFromId(videoId);
  return {
    title: `Watching: ${title}`,
  };
}

// The page now receives searchParams which might contain an error from a failed redirect
export default async function WatchPage({ params, searchParams }: { params: Promise<{ videoId: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { videoId } = await params;
  const resolvedSearchParams = await searchParams;
  
  // Try to get direct Azure URL for best performance
  const directUrl = await getDirectStreamUrl(videoId);
  
  // Fallback to proxy if direct URL not available
  const videoStreamUrl = directUrl || `/api/video/${encodeURIComponent(videoId)}`;
  const title = getTitleFromId(videoId);
  const thumbnail = getThumbnail(videoId);

  // Note: An error here is unlikely as the API route itself handles most errors.
  // This is a fallback for catastrophic failure.
  if (resolvedSearchParams.error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-lg">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Video</AlertTitle>
          <AlertDescription>
            Could not load the video stream. The API returned an error: {resolvedSearchParams.error}
          </AlertDescription>
        </Alert>
        <Link href="/" passHref>
            <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back Home
            </Button>
        </Link>
      </div>
    );
  }

  return (
    <NetflixPlayer src={videoStreamUrl} title={title} videoId={videoId} />
  );
}
