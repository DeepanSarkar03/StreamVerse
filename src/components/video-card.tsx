'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Video } from '@/lib/types';
import { cn } from '@/lib/utils';

const AzureIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.72 8.44L6.24 12.35L11.4 27.81L2.21 32.48L17.16 43.71L22.25 31.84L30.93 37.7L45.79 19.38L18.72 8.44Z" fill="#0078D4"/>
  </svg>
);


export function VideoCard({ video }: { video: Video }) {
    
  return (
    <Link href={`/watch/${encodeURIComponent(video.id)}`} className="group space-y-2" title={video.title}>
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
          <AzureIcon />
        </div>
      </div>
    </Link>
  );
}
