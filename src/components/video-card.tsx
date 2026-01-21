'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import type { Video } from '@/lib/types';
import { cn } from '@/lib/utils';

const AzureIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.72 8.44L6.24 12.35L11.4 27.81L2.21 32.48L17.16 43.71L22.25 31.84L30.93 37.7L45.79 19.38L18.72 8.44Z" fill="#0078D4"/>
  </svg>
);

interface PlaybackProgress {
  timestamp: number;
  duration: number;
  lastWatched: number;
}

interface ThumbnailData {
  poster: string | null;
  backdrop: string | null;
  title?: string;
  year?: string;
  source: 'tmdb' | 'itunes' | 'omdb' | 'placeholder';
}

// Cache thumbnails in memory to avoid repeated API calls
const thumbnailCache = new Map<string, ThumbnailData>();

// Clear old placeholder thumbnails on first load (one-time migration)
if (typeof window !== 'undefined') {
  const migrationKey = 'thumbnail_cache_v2';
  if (!localStorage.getItem(migrationKey)) {
    // Clear all old thumbnail caches
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('thumbnail_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(migrationKey, 'true');
    console.log('Cleared old thumbnail cache for improved movie posters');
  }
}

export function VideoCard({ video }: { video: Video }) {
  const [hasProgress, setHasProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [thumbnail, setThumbnail] = useState(video.thumbnail);
  const [isAiThumbnail, setIsAiThumbnail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch AI-powered thumbnail from TMDB
  useEffect(() => {
    const fetchThumbnail = async () => {
      // Check memory cache first
      if (thumbnailCache.has(video.id)) {
        const cached = thumbnailCache.get(video.id)!;
        if (cached.backdrop || cached.poster) {
          setThumbnail(cached.backdrop || cached.poster || video.thumbnail);
          setIsAiThumbnail(cached.source === 'tmdb' || cached.source === 'itunes' || cached.source === 'omdb');
        }
        setIsLoading(false);
        return;
      }

      // Check localStorage cache
      try {
        const stored = localStorage.getItem(`thumbnail_${video.id}`);
        if (stored) {
          const cached: ThumbnailData = JSON.parse(stored);
          thumbnailCache.set(video.id, cached);
          if (cached.backdrop || cached.poster) {
            setThumbnail(cached.backdrop || cached.poster || video.thumbnail);
            setIsAiThumbnail(cached.source === 'tmdb' || cached.source === 'itunes' || cached.source === 'omdb');
          }
          setIsLoading(false);
          return;
        }
      } catch {}

      // Fetch from API
      try {
        const response = await fetch(`/api/thumbnail?title=${encodeURIComponent(video.title)}`);
        if (response.ok) {
          const data: ThumbnailData = await response.json();
          thumbnailCache.set(video.id, data);
          
          // Cache in localStorage for persistence
          try {
            localStorage.setItem(`thumbnail_${video.id}`, JSON.stringify(data));
          } catch {}

          if (data.backdrop || data.poster) {
            // Prefer poster for better display, backdrop for wider images
            const imageUrl = data.poster || data.backdrop || video.thumbnail;
            setThumbnail(imageUrl);
            setIsAiThumbnail(data.source === 'tmdb' || data.source === 'itunes' || data.source === 'omdb');
          }
        }
      } catch (error) {
        console.error('Failed to fetch thumbnail:', error);
      }
      setIsLoading(false);
    };

    fetchThumbnail();
  }, [video.id, video.title, video.thumbnail]);

  // Check if there's saved progress for this video
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('streamverse_playback_progress');
      if (stored) {
        const allProgress = JSON.parse(stored) as Record<string, PlaybackProgress>;
        const videoProgress = allProgress[video.id];
        if (videoProgress && videoProgress.duration > 0) {
          const percent = (videoProgress.timestamp / videoProgress.duration) * 100;
          // Only show progress if less than 95% watched
          if (percent < 95) {
            setHasProgress(true);
            setProgressPercent(percent);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load playback progress:', error);
    }
  }, [video.id]);
    
  return (
    <Link href={`/watch/${encodeURIComponent(video.id)}`} className="group space-y-2" title={video.title}>
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-primary/20 relative">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        <Image
          src={thumbnail}
          alt={video.title}
          width={300}
          height={450}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          onError={(e) => {
              // Fallback for broken thumbnails
              const placeholder = 'https://picsum.photos/seed/streamverse-fallback/300/450';
              if (e.currentTarget.src !== placeholder) {
                  e.currentTarget.src = placeholder;
              }
              setIsLoading(false);
          }}
        />
        
        {/* Resume Button and Progress Bar */}
        {hasProgress && (
          <>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
              <div 
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            {/* Resume Button on Hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300 opacity-0 group-hover:opacity-100">
              <button className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors pointer-events-auto">
                <Play className="h-6 w-6 text-white fill-white" />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight truncate group-hover:text-primary">
            {video.title}
          </h3>
          {hasProgress && (
            <p className="text-xs text-muted-foreground mt-1">
              Continue watching • {Math.round(progressPercent)}%
            </p>
          )}
        </div>
        <div className="shrink-0 pt-0.5">
          <AzureIcon />
        </div>
      </div>
    </Link>
  );
}
