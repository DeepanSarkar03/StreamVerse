// @ts-nocheck
import { NextResponse } from 'next/server';
import type { Video } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface OneDriveFile {
  id: string;
  name: string;
  file: {
    mimeType: string;
  };
  thumbnails: { large?: { url: string } }[];
}

interface VideoProviderResult {
  videos: Video[];
  error: string | null;
}

const validVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm'];
const placeholderThumbnail = PlaceHolderImages.find(p => p.id === 'video-thumbnail')?.imageUrl || 'https://picsum.photos/seed/streamverse-thumb/400/225';

async function getOneDriveVideos(): Promise<VideoProviderResult> {
  const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    return { videos: [], error: "OneDrive is not configured in .env.local." };
  }

  // Select base properties and expand thumbnails separately.
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$select=id,name,file&$expand=thumbnails(select=large)`;
  
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 }, // Don't cache list
    });

    if (!res.ok) {
      const error = await res.json();
      const message = error.error?.message || 'An unknown error occurred.';
      console.error("Failed to fetch from OneDrive:", message);
      return { videos: [], error: `OneDrive: ${message}` };
    }

    const data = await res.json();
    const videos = (data.value || [])
      .filter((file: OneDriveFile) => file.file && validVideoExtensions.some(ext => file.name.toLowerCase().endsWith(ext)))
      .map((file: OneDriveFile) => ({
        id: `onedrive-${file.id}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        thumbnail: file.thumbnails?.[0]?.large?.url || placeholderThumbnail,
        source: 'onedrive',
      }));
    
    return { videos, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Network or parsing error fetching from OneDrive:", message);
    return { videos: [], error: `OneDrive: ${message}` };
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const onedriveResult = await getOneDriveVideos();

  const allVideos = [...onedriveResult.videos];
  const allErrors = [onedriveResult.error].filter((e): e is string => e !== null);
    
  allVideos.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ videos: allVideos, errors: allErrors });
}
