import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

async function getVideoData(videoId: string): Promise<{ url: string; title: string }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/video/${videoId}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch video URL. Status: ${res.status}`);
  }
  const data = await res.json();
  const title = decodeURIComponent(videoId.split(/-(.*)/s)[1] || 'Video');
  return { ...data, title };
}

export async function generateMetadata({ params }: { params: { videoId: string } }) {
  const [source, id] = params.videoId.split(/-(.*)/s);
  const title = id ? id.split('.').slice(0, -1).join('.') : 'StreamVerse Video';

  return {
    title: `Watching: ${decodeURIComponent(title)}`,
  };
}

export default async function WatchPage({ params }: { params: { videoId: string } }) {
  try {
    const { url, title } = await getVideoData(params.videoId);

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
          src={url}
          title={title}
        />
      </main>
    );
  } catch (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-lg">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Video</AlertTitle>
          <AlertDescription>
            Could not load the video stream. This might be due to an expired link or an issue with the storage provider.
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
}
