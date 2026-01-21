'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  UserProfile,
  WatchHistoryEntry,
  Playlist,
  AnalyticsData,
  PlaybackSettings,
  getUserProfile,
  createDefaultProfile,
  setUserProfile as saveUserProfile,
  getWatchHistory,
  addToWatchHistory as addHistory,
  clearWatchHistory as clearHistory,
  getPlaylists,
  createPlaylist as createList,
  addToPlaylist as addToList,
  removeFromPlaylist as removeFromList,
  deletePlaylist as deleteList,
  getRatings,
  setRating as saveRating,
  getReviews,
  addReview as saveReview,
  deleteReview as removeReview,
  getAnalytics,
  updateAnalytics as saveAnalytics,
  incrementVideosWatched,
  getPlaybackSettings,
  updatePlaybackSettings as savePlaybackSettings,
  Review,
} from '@/lib/storage';

interface AppContextType {
  // User Profile
  profile: UserProfile | null;
  updateProfile: (updates: Partial<UserProfile>) => void;
  
  // Watch History
  watchHistory: WatchHistoryEntry[];
  addToWatchHistory: (entry: Omit<WatchHistoryEntry, 'watchedAt'>) => void;
  clearWatchHistory: () => void;
  
  // Playlists
  playlists: Playlist[];
  createPlaylist: (name: string, description?: string) => Playlist;
  addToPlaylist: (playlistId: string, videoId: string) => void;
  removeFromPlaylist: (playlistId: string, videoId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  
  // Ratings
  ratings: Record<string, number>;
  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number | null;
  
  // Reviews
  reviews: Review[];
  addReview: (videoId: string, content: string) => void;
  deleteReview: (reviewId: string) => void;
  getReviewsForVideo: (videoId: string) => Review[];
  
  // Analytics
  analytics: AnalyticsData;
  trackWatchTime: (seconds: number, completed?: boolean) => void;
  trackVideoStarted: () => void;
  
  // Playback Settings
  playbackSettings: PlaybackSettings;
  updatePlaybackSettings: (settings: Partial<PlaybackSettings>) => void;
  
  // Loading state
  isLoaded: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalWatchTime: 0,
    videosWatched: 0,
    videosCompleted: 0,
    dailyStats: {},
    genreStats: {},
  });
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>({
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

  // Load all data on mount
  useEffect(() => {
    let existingProfile = getUserProfile();
    if (!existingProfile) {
      existingProfile = createDefaultProfile();
    }
    setProfile(existingProfile);
    setWatchHistory(getWatchHistory());
    setPlaylists(getPlaylists());
    
    const storedRatings = getRatings();
    const ratingMap: Record<string, number> = {};
    Object.values(storedRatings).forEach(r => {
      ratingMap[r.videoId] = r.rating;
    });
    setRatings(ratingMap);
    
    setReviews(getReviews());
    setAnalytics(getAnalytics());
    setPlaybackSettings(getPlaybackSettings());
    setIsLoaded(true);
  }, []);

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    saveUserProfile(updated);
    setProfile(updated);
  };

  const addToWatchHistory = (entry: Omit<WatchHistoryEntry, 'watchedAt'>) => {
    addHistory(entry);
    setWatchHistory(getWatchHistory());
  };

  const clearWatchHistoryHandler = () => {
    clearHistory();
    setWatchHistory([]);
  };

  const createPlaylistHandler = (name: string, description?: string) => {
    const playlist = createList(name, description || '');
    setPlaylists(getPlaylists());
    return playlist;
  };

  const addToPlaylistHandler = (playlistId: string, videoId: string) => {
    addToList(playlistId, videoId);
    setPlaylists(getPlaylists());
  };

  const removeFromPlaylistHandler = (playlistId: string, videoId: string) => {
    removeFromList(playlistId, videoId);
    setPlaylists(getPlaylists());
  };

  const deletePlaylistHandler = (playlistId: string) => {
    deleteList(playlistId);
    setPlaylists(getPlaylists());
  };

  const setRatingHandler = (videoId: string, rating: number) => {
    saveRating(videoId, rating);
    setRatings(prev => ({ ...prev, [videoId]: rating }));
  };

  const getRatingHandler = (videoId: string): number | null => {
    return ratings[videoId] ?? null;
  };

  const addReviewHandler = (videoId: string, content: string) => {
    saveReview(videoId, content);
    setReviews(getReviews());
  };

  const deleteReviewHandler = (reviewId: string) => {
    removeReview(reviewId);
    setReviews(getReviews());
  };

  const getReviewsForVideo = (videoId: string): Review[] => {
    return reviews.filter(r => r.videoId === videoId);
  };

  const trackWatchTime = (seconds: number, completed: boolean = false) => {
    saveAnalytics(seconds, completed);
    setAnalytics(getAnalytics());
  };

  const trackVideoStarted = () => {
    incrementVideosWatched();
    setAnalytics(getAnalytics());
  };

  const updatePlaybackSettingsHandler = (settings: Partial<PlaybackSettings>) => {
    savePlaybackSettings(settings);
    setPlaybackSettings(getPlaybackSettings());
  };

  return (
    <AppContext.Provider
      value={{
        profile,
        updateProfile,
        watchHistory,
        addToWatchHistory,
        clearWatchHistory: clearWatchHistoryHandler,
        playlists,
        createPlaylist: createPlaylistHandler,
        addToPlaylist: addToPlaylistHandler,
        removeFromPlaylist: removeFromPlaylistHandler,
        deletePlaylist: deletePlaylistHandler,
        ratings,
        setRating: setRatingHandler,
        getRating: getRatingHandler,
        reviews,
        addReview: addReviewHandler,
        deleteReview: deleteReviewHandler,
        getReviewsForVideo,
        analytics,
        trackWatchTime,
        trackVideoStarted,
        playbackSettings,
        updatePlaybackSettings: updatePlaybackSettingsHandler,
        isLoaded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
