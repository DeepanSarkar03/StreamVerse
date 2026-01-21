import { Suspense } from 'react';
import { Header } from '@/components/header';
import { VideoGrid } from '@/components/video-grid';
import { Skeleton } from '@/components/ui/skeleton';
import type { Video } from '@/lib/types';

interface FetchVideoResult {
  videos: Video[];
  errors: string[];
}

async function fetchVideos(): Promise<FetchVideoResult> {
  // Use a URL object to safely construct the URL
  const url = new URL('/api/videos', process.env.NEXT_PUBLIC_APP_URL);
  
  const res = await fetch(url, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Failed to fetch /api/videos endpoint:", res.status, errorText);
    throw new Error(`The video API endpoint failed to respond. Status: ${res.status}`);
  }

  return res.json();
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

async function VideoListContainer() {
  let videos: Video[] = [];
  let fetchErrorMessage: string | null = null;
  
  try {
    const { videos: fetchedVideos, errors } = await fetchVideos();
    videos = fetchedVideos;

    if (errors && errors.length > 0) {
      // If there are videos from one provider but errors from another, show both.
      // The primary error message takes precedence.
      const errorIntro = videos.length > 0 
        ? "Some videos could not be loaded." 
        : "Could not load any videos.";
      fetchErrorMessage = `${errorIntro} Details: ${errors.join('; ')}`;
    }

  } catch (error) {
    // This catches failures in fetching /api/videos itself
    fetchErrorMessage = error instanceof Error ? error.message : String(error);
  }
  
  return <VideoGrid initialVideos={videos} fetchErrorMessage={fetchErrorMessage} />;
}

async function HomeContent() {
  let videos: Video[] = [];
  
  try {
    const result = await fetchVideos();
    videos = result.videos;
  } catch {
    // Header will still work with empty videos
  }
  
  return (
    <>
      <Header videos={videos} />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoListContainer />
        </Suspense>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Suspense fallback={
        <>
          <div className="h-14 border-b border-border/40 bg-background/95" />
          <main className="flex-1 p-4 md:p-8">
            <VideoGridSkeleton />
          </main>
        </>
      }>
        <HomeContent />
      </Suspense>
    </div>
  );
}
