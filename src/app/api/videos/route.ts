// @ts-nocheck
import { NextResponse } from 'next/server';
import type { Video } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface GDriveFile {
  id: string;
  name: string;
  thumbnailLink?: string;
}

interface OneDriveFile {
  id: string;
  name: string;
  file: {
    mimeType: string;
  };
  thumbnails: { large?: { url: string } }[];
}

const validVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm'];
const validGdriveMimeTypes = ['video/mp4', 'video/x-matroska', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const placeholderThumbnail = PlaceHolderImages.find(p => p.id === 'video-thumbnail')?.imageUrl || 'https://picsum.photos/seed/streamverse-thumb/400/225';

async function getGoogleDriveVideos(): Promise<Video[]> {
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    console.warn("Google Drive environment variables are not fully set (access token or folder ID). Skipping Google Drive.");
    return [];
  }

  const mimeTypeQuery = validGdriveMimeTypes.map(m => `mimeType='${m}'`).join(' or ');
  const query = `'${folderId}' in parents and (${mimeTypeQuery}) and trashed=false`;
  const fields = 'files(id,name,thumbnailLink)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Failed to fetch from Google Drive:", error.error ? error.error.message : 'Unknown error');
    return [];
  }
  const data = await res.json();

  return (data.files || []).map((file: GDriveFile) => ({
    id: `gdrive-${file.id}`,
    title: file.name.replace(/\.[^/.]+$/, ""),
    thumbnail: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s400') : placeholderThumbnail,
    source: 'gdrive',
  }));
}

async function getOneDriveVideos(): Promise<Video[]> {
  const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    console.warn("OneDrive environment variables are not fully set. Skipping OneDrive.");
    return [];
  }

  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$expand=thumbnails(select=large)&$select=id,name,file,thumbnails`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Failed to fetch from OneDrive:", error.error.message);
    return [];
  }
  const data = await res.json();
  
  return (data.value || [])
    .filter((file: OneDriveFile) => file.file && validVideoExtensions.some(ext => file.name.toLowerCase().endsWith(ext)))
    .map((file: OneDriveFile) => ({
      id: `onedrive-${file.id}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      thumbnail: file.thumbnails?.[0]?.large?.url || placeholderThumbnail,
      source: 'onedrive',
    }));
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.allSettled([
    getGoogleDriveVideos(),
    getOneDriveVideos(),
  ]);

  const videos = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => (result as PromiseFulfilledResult<Video[]>).value);
    
  // Sort videos alphabetically by title
  videos.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json(videos);
}
