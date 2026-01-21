'use client';

import { useEffect, useState } from 'react';
import { X, ChevronUp } from 'lucide-react';
import { RatingStars, ReviewSection, ShareButton } from '@/components/social-features';
import { PlaylistManager } from '@/components/playlist-manager';
import { useApp } from '@/hooks/use-app-context';
import { cn } from '@/lib/utils';
import type { Video } from '@/lib/types';

interface VideoSocialFeaturesProps {
  videoId: string;
  title: string;
  thumbnail: string;
}

export function VideoSocialFeatures({ videoId, title, thumbnail }: VideoSocialFeaturesProps) {
  const { addToWatchHistory, trackVideoStarted, isLoaded } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasTracked, setHasTracked] = useState(false);

  // Track video start
  useEffect(() => {
    if (isLoaded && !hasTracked) {
      trackVideoStarted();
      setHasTracked(true);
    }
  }, [isLoaded, hasTracked, trackVideoStarted]);

  // Create video object for playlist manager
  const video: Video = {
    id: videoId,
    title,
    thumbnail,
    source: 'azure',
  };

  if (!isLoaded) return null;

  return (
    <>
      {/* Expandable panel at bottom */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t transition-transform duration-300",
          isExpanded ? "translate-y-0" : "translate-y-[calc(100%-48px)]"
        )}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <ChevronUp className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
          {isExpanded ? 'Hide' : 'Rate & Review'}
        </button>

        {/* Content */}
        <div className="p-4 pb-8 space-y-6 max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold mb-2">{title}</h3>
              <RatingStars videoId={videoId} size="lg" />
            </div>
            <div className="flex gap-2">
              <ShareButton videoId={videoId} title={title} />
              <PlaylistManager video={video} />
            </div>
          </div>

          <ReviewSection videoId={videoId} />
        </div>
      </div>
    </>
  );
}
