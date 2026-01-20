'use client';

import { useState, useMemo } from 'react';
import { VideoCard } from './video-card';
import type { Video } from '@/lib/types';
import { Input } from './ui/input';
import { Search } from 'lucide-react';

export function VideoGrid({ videos }: { videos: Video[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVideos = useMemo(() => {
    if (!searchTerm) {
      return videos;
    }
    return videos.filter((video) =>
      video.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [videos, searchTerm]);

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search videos..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
          <h2 className="text-2xl font-bold">No Results Found</h2>
          <p>No videos match your search for "{searchTerm}".</p>
        </div>
      )}
    </div>
  );
}
