'use client';

import type { Video } from '@/lib/types';
import { getWatchHistory, getRatings } from '@/lib/storage';

interface RecommendationScore {
  video: Video;
  score: number;
  reasons: string[];
}

export function getRecommendations(
  allVideos: Video[],
  currentVideoId?: string,
  limit: number = 10
): RecommendationScore[] {
  const watchHistory = getWatchHistory();
  const ratings = getRatings();
  
  // Get recently watched video IDs
  const recentlyWatched = new Set(watchHistory.slice(0, 20).map(h => h.videoId));
  
  // Get highly rated video IDs (4+ stars)
  const highlyRated = new Set(
    Object.entries(ratings)
      .filter(([_, r]) => r.rating >= 4)
      .map(([_, r]) => r.videoId)
  );

  // Extract keywords from watched videos for content-based filtering
  const watchedTitles = watchHistory.map(h => h.title.toLowerCase());
  const keywords = extractKeywords(watchedTitles);

  const recommendations: RecommendationScore[] = allVideos
    .filter(video => video.id !== currentVideoId)
    .map(video => {
      let score = 0;
      const reasons: string[] = [];
      const titleLower = video.title.toLowerCase();

      // Boost unwatched videos
      if (!recentlyWatched.has(video.id)) {
        score += 10;
        reasons.push('New to you');
      } else {
        // Small boost for rewatching liked content
        if (highlyRated.has(video.id)) {
          score += 5;
          reasons.push('You rated this highly');
        }
      }

      // Keyword matching
      const matchedKeywords = keywords.filter(kw => titleLower.includes(kw));
      if (matchedKeywords.length > 0) {
        score += matchedKeywords.length * 3;
        reasons.push('Similar to your interests');
      }

      // Recency bias - slightly prefer videos not watched for a while
      const lastWatch = watchHistory.find(h => h.videoId === video.id);
      if (lastWatch) {
        const daysSinceWatch = (Date.now() - lastWatch.watchedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceWatch > 30) {
          score += 2;
          reasons.push('Watch again');
        }
      }

      // Completion-based - boost videos user didn't finish
      if (lastWatch && !lastWatch.completed && lastWatch.watchedDuration > 60) {
        score += 8;
        reasons.push('Continue watching');
      }

      // Random factor for diversity
      score += Math.random() * 2;

      return { video, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return recommendations;
}

function extractKeywords(titles: string[]): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'mp4', 'mkv', 'avi', 'mov', '1080p', '720p', '480p', '4k', 'hd',
  ]);

  const wordCounts: Record<string, number> = {};

  titles.forEach(title => {
    const words = title
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  // Return words that appear more than once
  return Object.entries(wordCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Get "Continue Watching" videos
export function getContinueWatching(allVideos: Video[]): Video[] {
  const watchHistory = getWatchHistory();
  
  return watchHistory
    .filter(h => !h.completed && h.watchedDuration > 30)
    .slice(0, 10)
    .map(h => allVideos.find(v => v.id === h.videoId))
    .filter((v): v is Video => v !== undefined);
}

// Get "Because You Watched" recommendations
export function getBecauseYouWatched(
  allVideos: Video[],
  recentVideo: Video
): Video[] {
  const titleWords = recentVideo.title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  return allVideos
    .filter(v => v.id !== recentVideo.id)
    .map(video => {
      const titleLower = video.title.toLowerCase();
      const matches = titleWords.filter(w => titleLower.includes(w)).length;
      return { video, matches };
    })
    .filter(item => item.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 6)
    .map(item => item.video);
}
