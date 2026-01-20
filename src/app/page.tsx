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

async function VideoList() {
  try {
    const videos = await fetchVideos();
    
    if (videos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
          <h2 className="text-2xl font-bold">No Videos Found</h2>
          <p>Your configured folders might be empty.</p>
          <p>Try uploading some videos to get started!</p>
        </div>
      );
    }
    
    return <VideoGrid videos={videos} />;
  } catch (error) {
    return (
       <div className="flex flex-col items-center justify-center text-center text-destructive h-64 bg-destructive/10 rounded-lg">
          <h2 className="text-2xl font-bold">Could not load videos</h2>
          <p className="max-w-md mt-2">There was an issue connecting to Google Drive or OneDrive. Please ensure your API keys, tokens, and folder IDs in `.env.local` are correct and have the necessary permissions.</p>
        </div>
    )
  }
}

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoList />
        </Suspense>
      </main>
    </div>
  );
}
