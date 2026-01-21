'use client';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { UploadDialog } from '@/components/upload-dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdvancedPlaybackSettings } from '@/components/advanced-playback-settings';
import { UserProfileSheet } from '@/components/user-profile-sheet';
import { PlaylistManager } from '@/components/playlist-manager';
import { useDownloads } from '@/lib/downloads-store';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Video } from '@/lib/types';

interface HeaderProps {
  videos?: Video[];
}

export function Header({ videos = [] }: HeaderProps) {
  const { activeDownloads } = useDownloads();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-auto" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-1 sm:space-x-2">
          <Link href="/downloads">
            <Button variant="ghost" size="icon" className="relative">
              <Download className="h-4 w-4" />
              {activeDownloads.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                  {activeDownloads.length}
                </span>
              )}
            </Button>
          </Link>
          <PlaylistManager />
          <AdvancedPlaybackSettings />
          <ThemeToggle />
          <UploadDialog />
          <UserProfileSheet videos={videos} />
        </div>
      </div>
    </header>
  );
}
