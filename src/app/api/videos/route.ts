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

interface VideoProviderResult {
  videos: Video[];
  error: string | null;
}

const validVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm'];
const validGdriveMimeTypes = ['video/mp4', 'video/x-matroska', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const placeholderThumbnail = PlaceHolderImages.find(p => p.id === 'video-thumbnail')?.imageUrl || 'https://picsum.photos/seed/streamverse-thumb/400/225';

async function getGoogleDriveVideos(): Promise<VideoProviderResult> {
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    const message = "Google Drive environment variables are not fully set (access token or folder ID).";
    console.warn(message);
    return { videos: [], error: message };
  }

  const mimeTypeQuery = validGdriveMimeTypes.map(m => `mimeType='${m}'`).join(' or ');
  const query = `'${folderId}' in parents and (${mimeTypeQuery}) and trashed=false`;
  const fields = 'files(id,name,thumbnailLink)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      next: { revalidate: 0 }, // Don't cache list
    });

    if (!res.ok) {
      const error = await res.json();
      const message = error.error?.message || 'An unknown error occurred.';
      console.error("Failed to fetch from Google Drive:", message);
      return { videos: [], error: `Google Drive: ${message}` };
    }

    const data = await res.json();
    const videos = (data.files || []).map((file: GDriveFile) => ({
      id: `gdrive-${file.id}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      thumbnail: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s400') : placeholderThumbnail,
      source: 'gdrive',
    }));

    return { videos, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
     console.error("Network or parsing error fetching from Google Drive:", message);
    return { videos: [], error: `Google Drive: ${message}` };
  }
}

async function getOneDriveVideos(): Promise<VideoProviderResult> {
  const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    const message = "OneDrive environment variables are not fully set.";
    console.warn(message);
    return { videos: [], error: message };
  }

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
  const [gdriveResult, onedriveResult] = await Promise.all([
    getGoogleDriveVideos(),
    getOneDriveVideos(),
  ]);

  const allVideos = [...gdriveResult.videos, ...onedriveResult.videos];
  const allErrors = [gdriveResult.error, onedriveResult.error].filter((e): e is string => e !== null);
    
  allVideos.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ videos: allVideos, errors: allErrors });
}
