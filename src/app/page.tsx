import { Suspense } from 'react';
import { Header } from '@/components/header';
import { VideoGrid } from '@/components/video-grid';
import { Skeleton } from '@/components/ui/skeleton';
import type { Video } from '@/lib/types';

async function fetchVideos(): Promise<Video[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/videos`, {
    next: { tags: ['videos'] },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Failed to fetch videos:", res.status, errorText);
    throw new Error('Failed to load videos. Please check server logs and environment variables.');
  }

  return res.json();
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
    videos = await fetchVideos();
  } catch (error) {
    fetchErrorMessage = error instanceof Error ? error.message : String(error);
  }
  return <VideoGrid initialVideos={videos} fetchErrorMessage={fetchErrorMessage} />;
}


export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoListContainer />
        </Suspense>
      </main>
    </div>
  );
}
