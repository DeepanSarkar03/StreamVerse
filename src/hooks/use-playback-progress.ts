'use client';

import { useCallback, useEffect, useState } from 'react';

interface PlaybackProgress {
  timestamp: number;
  duration: number;
  lastWatched: number; // unix timestamp
}

const STORAGE_KEY = 'streamverse_playback_progress';
const RESUME_THRESHOLD = 0.95; // Only save progress if watched less than 95% of the video

export function usePlaybackProgress(videoId: string) {
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allProgress = JSON.parse(stored) as Record<string, PlaybackProgress>;
        setProgress(allProgress[videoId] || null);
      }
    } catch (error) {
      console.error('Failed to load playback progress:', error);
    }
    setIsLoaded(true);
  }, [videoId]);

  // Save progress to localStorage
  const saveProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (typeof window === 'undefined') return;

      // Don't save if video is nearly finished
      if (duration > 0 && currentTime / duration > RESUME_THRESHOLD) {
        // Video is essentially watched, clear the progress
        clearProgress();
        return;
      }

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const allProgress = stored ? JSON.parse(stored) : {};

        allProgress[videoId] = {
          timestamp: currentTime,
          duration,
          lastWatched: Date.now(),
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
        setProgress(allProgress[videoId]);
      } catch (error) {
        console.error('Failed to save playback progress:', error);
      }
    },
    [videoId]
  );

  // Clear progress for a video
  const clearProgress = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allProgress = JSON.parse(stored) as Record<string, PlaybackProgress>;
        delete allProgress[videoId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
        setProgress(null);
      }
    } catch (error) {
      console.error('Failed to clear playback progress:', error);
    }
  }, [videoId]);

  return {
    progress,
    isLoaded,
    saveProgress,
    clearProgress,
    hasProgress: progress !== null && progress.timestamp > 0,
  };
}
