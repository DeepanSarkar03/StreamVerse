'use client';

import { useState } from 'react';
import { Plus, List, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/hooks/use-app-context';
import { useToast } from '@/hooks/use-toast';
import type { Video } from '@/lib/types';

interface PlaylistManagerProps {
  video?: Video;
  triggerButton?: React.ReactNode;
}

export function PlaylistManager({ video, triggerButton }: PlaylistManagerProps) {
  const { playlists, createPlaylist, addToPlaylist, deletePlaylist } = useApp();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const playlist = createPlaylist(newPlaylistName.trim());
      if (video) {
        addToPlaylist(playlist.id, video.id);
        toast({
          title: 'Added to playlist',
          description: `"${video.title}" added to "${playlist.name}"`,
        });
      }
      setNewPlaylistName('');
      setShowCreate(false);
      setIsOpen(false);
    }
  };

  const handleAddToPlaylist = (playlistId: string, playlistName: string) => {
    if (video) {
      addToPlaylist(playlistId, video.id);
      toast({
        title: 'Added to playlist',
        description: `"${video.title}" added to "${playlistName}"`,
      });
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add to Playlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {video ? `Add "${video.title}" to Playlist` : 'Manage Playlists'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Playlists */}
          {playlists.length > 0 && video && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Playlists</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {playlists.map((playlist) => {
                  const isInPlaylist = playlist.videoIds.includes(video.id);
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => !isInPlaylist && handleAddToPlaylist(playlist.id, playlist.name)}
                      disabled={isInPlaylist}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <List className="h-4 w-4" />
                        <div className="text-left">
                          <p className="font-medium">{playlist.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {playlist.videoIds.length} videos
                          </p>
                        </div>
                      </div>
                      {isInPlaylist && (
                        <span className="text-xs text-green-500">Added</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create New Playlist */}
          {showCreate ? (
            <div className="space-y-3">
              <Input
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Create New Playlist
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PlaylistDisplayProps {
  videos: Video[];
}

export function PlaylistDisplay({ videos }: PlaylistDisplayProps) {
  const { playlists, deletePlaylist, removeFromPlaylist } = useApp();
  const { toast } = useToast();

  if (playlists.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No playlists yet</p>
        <p className="text-sm">Create a playlist to organize your videos</p>
      </div>
    );
  }

  const getVideosForPlaylist = (videoIds: string[]) => {
    return videoIds
      .map(id => videos.find(v => v.id === id))
      .filter((v): v is Video => v !== undefined);
  };

  return (
    <div className="space-y-6">
      {playlists.map((playlist) => {
        const playlistVideos = getVideosForPlaylist(playlist.videoIds);
        
        return (
          <div key={playlist.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {playlist.videoIds.length} videos
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      deletePlaylist(playlist.id);
                      toast({
                        title: 'Playlist deleted',
                        description: `"${playlist.name}" has been deleted`,
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {playlistVideos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {playlistVideos.slice(0, 6).map((video) => (
                  <div key={video.id} className="relative group">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="aspect-video w-full rounded-md object-cover"
                    />
                    <button
                      onClick={() => removeFromPlaylist(playlist.id, video.id)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No videos in this playlist</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
