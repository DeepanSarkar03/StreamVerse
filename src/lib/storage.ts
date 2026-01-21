'use client';

// Centralized localStorage utility for all app features

const KEYS = {
  USER_PROFILE: 'streamverse_user_profile',
  WATCH_HISTORY: 'streamverse_watch_history',
  PLAYLISTS: 'streamverse_playlists',
  RATINGS: 'streamverse_ratings',
  REVIEWS: 'streamverse_reviews',
  ANALYTICS: 'streamverse_analytics',
  PLAYBACK_SETTINGS: 'streamverse_playback_settings',
  PLAYBACK_PROGRESS: 'streamverse_playback_progress',
} as const;

// User Profile
export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

// Watch History Entry
export interface WatchHistoryEntry {
  videoId: string;
  title: string;
  thumbnail: string;
  watchedAt: number;
  duration: number;
  watchedDuration: number;
  completed: boolean;
}

// Playlist
export interface Playlist {
  id: string;
  name: string;
  description: string;
  videoIds: string[];
  createdAt: number;
  updatedAt: number;
}

// Rating
export interface Rating {
  videoId: string;
  rating: number; // 1-5 stars
  ratedAt: number;
}

// Review
export interface Review {
  id: string;
  videoId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Analytics
export interface AnalyticsData {
  totalWatchTime: number; // in seconds
  videosWatched: number;
  videosCompleted: number;
  dailyStats: Record<string, { watchTime: number; videos: number }>;
  genreStats: Record<string, number>;
}

// Playback Settings
export interface PlaybackSettings {
  defaultVolume: number;
  defaultPlaybackSpeed: number;
  autoplay: boolean;
  autoNextEpisode: boolean;
  defaultQuality: string;
  defaultEnhancement: string;
  showCaptions: boolean;
  captionSize: 'small' | 'medium' | 'large';
  captionBackground: boolean;
}

// Generic storage functions
function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
}

// User Profile
export function getUserProfile(): UserProfile | null {
  return getItem<UserProfile | null>(KEYS.USER_PROFILE, null);
}

export function setUserProfile(profile: UserProfile): void {
  setItem(KEYS.USER_PROFILE, profile);
}

export function createDefaultProfile(): UserProfile {
  const profile: UserProfile = {
    id: `user_${Date.now()}`,
    name: 'Guest',
    avatar: '👤',
    createdAt: Date.now(),
  };
  setUserProfile(profile);
  return profile;
}

// Watch History
export function getWatchHistory(): WatchHistoryEntry[] {
  return getItem<WatchHistoryEntry[]>(KEYS.WATCH_HISTORY, []);
}

export function addToWatchHistory(entry: Omit<WatchHistoryEntry, 'watchedAt'>): void {
  const history = getWatchHistory();
  const existingIndex = history.findIndex(h => h.videoId === entry.videoId);
  
  const newEntry: WatchHistoryEntry = {
    ...entry,
    watchedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    history[existingIndex] = newEntry;
  } else {
    history.unshift(newEntry);
  }

  // Keep only last 100 entries
  setItem(KEYS.WATCH_HISTORY, history.slice(0, 100));
}

export function clearWatchHistory(): void {
  setItem(KEYS.WATCH_HISTORY, []);
}

// Playlists
export function getPlaylists(): Playlist[] {
  return getItem<Playlist[]>(KEYS.PLAYLISTS, []);
}

export function createPlaylist(name: string, description: string = ''): Playlist {
  const playlists = getPlaylists();
  const newPlaylist: Playlist = {
    id: `playlist_${Date.now()}`,
    name,
    description,
    videoIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  playlists.push(newPlaylist);
  setItem(KEYS.PLAYLISTS, playlists);
  return newPlaylist;
}

export function addToPlaylist(playlistId: string, videoId: string): void {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist && !playlist.videoIds.includes(videoId)) {
    playlist.videoIds.push(videoId);
    playlist.updatedAt = Date.now();
    setItem(KEYS.PLAYLISTS, playlists);
  }
}

export function removeFromPlaylist(playlistId: string, videoId: string): void {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.videoIds = playlist.videoIds.filter(id => id !== videoId);
    playlist.updatedAt = Date.now();
    setItem(KEYS.PLAYLISTS, playlists);
  }
}

export function deletePlaylist(playlistId: string): void {
  const playlists = getPlaylists().filter(p => p.id !== playlistId);
  setItem(KEYS.PLAYLISTS, playlists);
}

// Ratings
export function getRatings(): Record<string, Rating> {
  return getItem<Record<string, Rating>>(KEYS.RATINGS, {});
}

export function getRating(videoId: string): number | null {
  const ratings = getRatings();
  return ratings[videoId]?.rating ?? null;
}

export function setRating(videoId: string, rating: number): void {
  const ratings = getRatings();
  ratings[videoId] = { videoId, rating, ratedAt: Date.now() };
  setItem(KEYS.RATINGS, ratings);
}

// Reviews
export function getReviews(): Review[] {
  return getItem<Review[]>(KEYS.REVIEWS, []);
}

export function getReviewsForVideo(videoId: string): Review[] {
  return getReviews().filter(r => r.videoId === videoId);
}

export function addReview(videoId: string, content: string): Review {
  const reviews = getReviews();
  const newReview: Review = {
    id: `review_${Date.now()}`,
    videoId,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  reviews.unshift(newReview);
  setItem(KEYS.REVIEWS, reviews);
  return newReview;
}

export function deleteReview(reviewId: string): void {
  const reviews = getReviews().filter(r => r.id !== reviewId);
  setItem(KEYS.REVIEWS, reviews);
}

// Analytics
export function getAnalytics(): AnalyticsData {
  return getItem<AnalyticsData>(KEYS.ANALYTICS, {
    totalWatchTime: 0,
    videosWatched: 0,
    videosCompleted: 0,
    dailyStats: {},
    genreStats: {},
  });
}

export function updateAnalytics(watchTime: number, completed: boolean = false): void {
  const analytics = getAnalytics();
  const today = new Date().toISOString().split('T')[0];

  analytics.totalWatchTime += watchTime;
  if (!analytics.dailyStats[today]) {
    analytics.dailyStats[today] = { watchTime: 0, videos: 0 };
  }
  analytics.dailyStats[today].watchTime += watchTime;
  
  if (completed) {
    analytics.videosCompleted += 1;
    analytics.dailyStats[today].videos += 1;
  }

  setItem(KEYS.ANALYTICS, analytics);
}

export function incrementVideosWatched(): void {
  const analytics = getAnalytics();
  analytics.videosWatched += 1;
  setItem(KEYS.ANALYTICS, analytics);
}

// Playback Settings
export function getPlaybackSettings(): PlaybackSettings {
  return getItem<PlaybackSettings>(KEYS.PLAYBACK_SETTINGS, {
    defaultVolume: 1,
    defaultPlaybackSpeed: 1,
    autoplay: true,
    autoNextEpisode: true,
    defaultQuality: 'auto',
    defaultEnhancement: 'off',
    showCaptions: false,
    captionSize: 'medium',
    captionBackground: true,
  });
}

export function updatePlaybackSettings(settings: Partial<PlaybackSettings>): void {
  const current = getPlaybackSettings();
  setItem(KEYS.PLAYBACK_SETTINGS, { ...current, ...settings });
}
