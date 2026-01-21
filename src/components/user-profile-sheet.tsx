'use client';

import { useState, useEffect } from 'react';
import { User, History, BarChart3, List, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useApp } from '@/hooks/use-app-context';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { PlaylistDisplay } from '@/components/playlist-manager';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Video } from '@/lib/types';
import Link from 'next/link';

const AVATAR_OPTIONS = ['👤', '😎', '🎬', '🍿', '🎭', '🎮', '🌟', '🔥', '💎', '🦊', '🐱', '🐶'];

interface UserProfileSheetProps {
  videos: Video[];
}

export function UserProfileSheet({ videos }: UserProfileSheetProps) {
  const { profile, updateProfile, watchHistory, clearWatchHistory, isLoaded } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
    }
  }, [profile]);

  if (!isLoaded || !profile) return null;

  const handleSaveName = () => {
    if (editName.trim()) {
      updateProfile({ name: editName.trim() });
      setIsEditingName(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-lg bg-primary/20">
              {profile.avatar}
            </AvatarFallback>
          </Avatar>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 pt-4">
            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <button
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl hover:bg-primary/30 transition-colors"
                >
                  {profile.avatar}
                </button>
                {showAvatarPicker && (
                  <div className="absolute top-full left-0 mt-2 p-2 bg-popover border rounded-lg shadow-lg grid grid-cols-6 gap-1 z-50">
                    {AVATAR_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          updateProfile({ avatar: emoji });
                          setShowAvatarPicker(false);
                        }}
                        className="h-8 w-8 text-lg hover:bg-muted rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                      className="h-8"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{profile.name}</h2>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingName(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="history" className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </TabsTrigger>
                <TabsTrigger value="playlists" className="gap-2">
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Playlists</span>
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Stats</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                <div className="space-y-4">
                  {watchHistory.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive gap-2"
                        onClick={clearWatchHistory}
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear History
                      </Button>
                    </div>
                  )}
                  
                  {watchHistory.length > 0 ? (
                    <div className="space-y-3">
                      {watchHistory.map((entry) => (
                        <Link
                          key={`${entry.videoId}-${entry.watchedAt}`}
                          href={`/watch/${encodeURIComponent(entry.videoId)}`}
                          onClick={() => setIsOpen(false)}
                          className="flex gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          <img
                            src={entry.thumbnail}
                            alt={entry.title}
                            className="w-24 aspect-video rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{entry.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.watchedAt).toLocaleDateString()}
                            </p>
                            {entry.completed ? (
                              <span className="text-xs text-green-500">Completed</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {Math.round((entry.watchedDuration / entry.duration) * 100)}% watched
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No watch history yet</p>
                      <p className="text-sm">Start watching to build your history</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="playlists" className="mt-4">
                <PlaylistDisplay videos={videos} />
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <AnalyticsDashboard />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
