import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

// This page now receives the video URL directly from the API redirect.
// We can't easily get the title on the server anymore, but we can decode it from the videoId param.
function getTitleFromId(videoId: string): string {
  try {
    const titlePart = videoId.split(/-(.*)/s)[1] || 'Video';
    // Clean up file extensions
    const cleanedTitle = titlePart.replace(/\.(mp4|mkv|mov|avi|webm)$/i, '');
    return decodeURIComponent(cleanedTitle);
  } catch {
    return "Video";
  }
}

export async function generateMetadata({ params }: { params: { videoId: string } }) {
  const title = getTitleFromId(params.videoId);
  return {
    title: `Watching: ${title}`,
  };
}

// The page now receives searchParams which might contain an error from a failed redirect
export default async function WatchPage({ params, searchParams }: { params: { videoId: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
  const videoStreamUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/video/${params.videoId}`;
  const title = getTitleFromId(params.videoId);

  // Note: An error here is unlikely as the API route itself handles most errors.
  // This is a fallback for catastrophic failure.
  if (searchParams.error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-lg">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Video</AlertTitle>
          <AlertDescription>
            Could not load the video stream. The API returned an error: {searchParams.error}
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
    <main className="relative h-screen w-screen bg-black flex items-center justify-center">
      <Link href="/" passHref>
        <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black/75 text-white hover:text-white">
          <ArrowLeft className="h-6 w-6" />
          <span className="sr-only">Back to Home</span>
        </Button>
      </Link>
      <video
        className="h-full w-full"
        controls
        autoPlay
        src={videoStreamUrl} // The browser will follow the redirect from our API route
        title={title}
      />
    </main>
  );
}
