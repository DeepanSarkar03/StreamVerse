'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Video } from '@/lib/types';
import { cn } from '@/lib/utils';

const OneDriveIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5">
    <path fill="#0078d4" d="M12.2 14.2c-2.4 1-4.1 3.2-4.1 5.9 0 3.5 2.8 6.3 6.3 6.3h22.4c2.8 0 5-2.2 5-5s-2.2-5-5-5c-1.3 0-2.5.5-3.4 1.4-.8-3.1-3.6-5.4-6.9-5.4-3.1 0-5.7 2-6.7 4.8-.4-.1-.8-.2-1.2-.2-2.9.1-5.3 2.4-5.4 5.2z" />
  </svg>
);


export function VideoCard({ video }: { video: Video }) {
    
  return (
    <Link href={`/watch/${video.id}`} className="group space-y-2" title={video.title}>
      <div className="aspect-video w-full overflow-hidden rounded-md bg-card shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-primary/20">
        <Image
          src={video.thumbnail}
          alt={video.title}
          width={400}
          height={225}
          className="h-full w-full object-cover"
          // Add a hint for AI image generation tools
          data-ai-hint="movie still"
          onError={(e) => {
              // Fallback for broken thumbnails
              const placeholder = 'https://picsum.photos/seed/streamverse-fallback/400/225';
              if (e.currentTarget.src !== placeholder) {
                  e.currentTarget.src = placeholder;
              }
          }}
        />
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight truncate group-hover:text-primary">
          {video.title}
        </h3>
        <div className="shrink-0 pt-0.5">
          <OneDriveIcon />
        </div>
      </div>
    </Link>
  );
}
