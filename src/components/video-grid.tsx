'use client';

import { useState, useMemo, useTransition } from 'react';
import { VideoCard } from './video-card';
import type { Video } from '@/lib/types';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Loader2, Search } from 'lucide-react';
import { filterVideos } from '@/ai/flows/filter-videos-flow';
import { useToast } from '@/hooks/use-toast';

export function VideoGrid({ initialVideos, fetchErrorMessage }: { initialVideos: Video[], fetchErrorMessage: string | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVideos, setFilteredVideos] = useState<Video[]>(fetchErrorMessage ? [] : initialVideos);
  const [isSearching, startTransition] = useTransition();
  const { toast } = useToast();

  const allVideoTitles = useMemo(() => initialVideos.map(v => v.title), [initialVideos]);

  const handleSearch = () => {
    if (fetchErrorMessage || initialVideos.length === 0) return;

    startTransition(async () => {
      if (!searchTerm.trim()) {
        setFilteredVideos(initialVideos);
        return;
      }

      try {
        const result = await filterVideos({ query: searchTerm, videos: allVideoTitles });
        if (result && result.filteredVideos) {
          const filteredTitles = new Set(result.filteredVideos);
          const newFilteredVideos = initialVideos.filter(v => filteredTitles.has(v.title));
          setFilteredVideos(newFilteredVideos);
        } else {
          setFilteredVideos([]);
        }
      } catch (error) {
        console.error("AI search failed:", error);
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: 'The AI search encountered an error. Please try again.',
        });
        setFilteredVideos(initialVideos);
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim() === '') {
      setFilteredVideos(fetchErrorMessage ? [] : initialVideos);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-full max-w-lg mx-auto items-center space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search action movies, 80s comedies..."
            className="pl-9"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!!fetchErrorMessage || initialVideos.length === 0}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !!fetchErrorMessage || initialVideos.length === 0}>
          {isSearching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </div>

      {fetchErrorMessage ? (
         <div className="flex flex-col items-center justify-center text-center text-destructive h-64 bg-destructive/10 rounded-lg">
            <h2 className="text-2xl font-bold">Could not load videos</h2>
            <p className="max-w-md mt-2">There was an issue connecting to Google Drive or OneDrive. Please ensure your API keys, tokens, and folder IDs in `.env.local` are correct and have the necessary permissions.</p>
          </div>
      ) : initialVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
          <h2 className="text-2xl font-bold">No Videos Found</h2>
          <p>Your configured folders might be empty.</p>
          <p>Try uploading some videos to get started!</p>
        </div>
      ) : (
        <div className={isSearching ? 'opacity-50 transition-opacity duration-300' : ''}>
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
              <h2 className="text-2xl font-bold">No Results Found</h2>
              <p>Your AI-powered search for "{searchTerm}" did not find any matches.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
