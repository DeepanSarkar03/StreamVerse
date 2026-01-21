'use server';

import { revalidatePath } from 'next/cache';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';

export async function uploadVideo(prevState: any, formData: FormData) {
  const file = formData.get('file') as File | null;
  const destination = formData.get('destination') as 'azure' | null;
  const customName = formData.get('customName') as string | null;

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }
  if (!destination || destination !== 'azure') {
    return { error: 'Invalid destination.' };
  }

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!connectionString || !containerName) {
      return { error: 'Azure Storage environment variables are not set on the server.' };
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure the container exists. For this app, we assume it's publicly accessible for blobs.
    await containerClient.createIfNotExists({ access: 'blob' });

    // Determine the blob name - use custom name if provided, otherwise use original filename
    let blobName: string;
    if (customName && customName.trim() !== '') {
      // Use custom name, preserve extension from original file
      const originalExt = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
      let name = customName.trim();
      // If custom name already has an extension, use it; otherwise add original extension
      if (!name.includes('.')) {
        name += originalExt;
      }
      // Sanitize the filename
      blobName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    } else {
      blobName = file.name; // Use the original file name as the blob name
    }
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // This is the critical fix: Use streams to avoid loading the entire file into memory.
    // Convert the web stream from the File object to a Node.js stream that the Azure SDK expects.
    const nodeStream = Readable.fromWeb(file.stream() as any);

    await blockBlobClient.uploadStream(nodeStream, undefined, undefined, {
        blobHTTPHeaders: { blobContentType: file.type }
    });

    revalidatePath('/');
    return { success: `Successfully uploaded "${file.name}" to Azure Blob Storage.` };

  } catch (e) {
    let errorMessage = 'An unknown error occurred during upload.';
    if (e instanceof Error) {
        errorMessage = `An unexpected server error occurred: ${e.message}`;
    }
    console.error(errorMessage, e); // Log the full error on the server
    return { error: errorMessage };
  }
}

// Convert sharing URLs from various services to direct download URLs
function convertToDirectUrl(url: string): { url: string; service: string | null } {
  const urlLower = url.toLowerCase();
  
  // Google Drive
  // Formats: 
  // - https://drive.google.com/file/d/FILE_ID/view
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID
  if (urlLower.includes('drive.google.com')) {
    let fileId: string | null = null;
    
    // Extract file ID from /file/d/FILE_ID/ format
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }
    
    // Extract from ?id=FILE_ID format
    if (!fileId) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        fileId = idMatch[1];
      }
    }
    
    if (fileId) {
      // Use the direct download URL format
      return { 
        url: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        service: 'Google Drive'
      };
    }
  }
  
  // OneDrive / SharePoint
  // Formats:
  // - https://1drv.ms/v/...
  // - https://onedrive.live.com/...
  // - https://*.sharepoint.com/...
  if (urlLower.includes('1drv.ms') || urlLower.includes('onedrive.live.com') || urlLower.includes('sharepoint.com')) {
    // Convert to direct download by changing the URL format
    // For 1drv.ms links, we need to convert to direct download
    if (urlLower.includes('1drv.ms')) {
      // Replace the base64 part to get download link
      const base64Part = url.split('/').pop();
      if (base64Part) {
        try {
          // 1drv.ms links can be converted by adding download=1
          return { 
            url: `${url.split('?')[0]}?download=1`,
            service: 'OneDrive'
          };
        } catch {
          // Fall through to original URL
        }
      }
    }
    
    // For other OneDrive/SharePoint links, try adding download=1
    const separator = url.includes('?') ? '&' : '?';
    return { 
      url: `${url}${separator}download=1`,
      service: 'OneDrive'
    };
  }
  
  // Dropbox
  // Format: https://www.dropbox.com/s/... or https://www.dropbox.com/scl/fi/...
  if (urlLower.includes('dropbox.com')) {
    // Change dl=0 to dl=1 for direct download
    let directUrl = url.replace(/dl=0/, 'dl=1');
    // If no dl parameter, add it
    if (!directUrl.includes('dl=1')) {
      const separator = directUrl.includes('?') ? '&' : '?';
      directUrl = `${directUrl}${separator}dl=1`;
    }
    return { url: directUrl, service: 'Dropbox' };
  }
  
  // Mega.nz - these require special handling and usually don't work with direct fetch
  if (urlLower.includes('mega.nz') || urlLower.includes('mega.co.nz')) {
    return { url, service: 'Mega' };
  }
  
  // MediaFire
  // Format: https://www.mediafire.com/file/...
  if (urlLower.includes('mediafire.com/file/')) {
    // MediaFire direct links need the /file/ path
    return { url, service: 'MediaFire' };
  }
  
  // pCloud
  if (urlLower.includes('pcloud.com')) {
    // Add forcedownload=1 for direct download
    const separator = url.includes('?') ? '&' : '?';
    return { 
      url: `${url}${separator}forcedownload=1`,
      service: 'pCloud'
    };
  }

  // GitHub raw files
  if (urlLower.includes('github.com') && !urlLower.includes('raw.githubusercontent.com')) {
    // Convert github.com blob URLs to raw URLs
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    return { url: rawUrl, service: 'GitHub' };
  }

  // Box.com
  if (urlLower.includes('box.com/s/')) {
    // Box shared links can be converted to direct download
    const directUrl = url.replace('/s/', '/shared/static/');
    return { url: directUrl, service: 'Box' };
  }
  
  // Return original URL if no conversion needed
  return { url, service: null };
}

export async function importVideoFromUrl(prevState: any, formData: FormData) {
  const url = formData.get('url') as string | null;
  const customName = formData.get('customName') as string | null;

  if (!url || url.trim() === '') {
    return { error: 'Please enter a valid URL.' };
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { error: 'Only HTTP and HTTPS URLs are supported.' };
    }
  } catch {
    return { error: 'Please enter a valid URL.' };
  }

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!connectionString || !containerName) {
      return { error: 'Azure Storage environment variables are not set on the server.' };
    }

    // Convert the URL to a direct download link if it's from a known service
    const { url: directUrl, service } = convertToDirectUrl(url);
    console.log(`Importing from ${service || 'direct URL'}: ${directUrl}`);

    // Create an AbortController with a 5 minute timeout for the initial fetch
    // (longer timeout for cloud storage services that may be slow)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    // Fetch the video from the URL
    let response: Response;
    try {
      response = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'identity', // Avoid compression for video files
        },
        signal: controller.signal,
        redirect: 'follow', // Follow redirects automatically
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return { error: `Request timed out after 5 minutes. ${service ? `The ${service} link may require manual download.` : 'The URL may not be accessible.'}` };
      }
      throw fetchError;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        return { error: `Access denied (403). ${service ? `The ${service} file may not be publicly shared.` : 'The file may require authentication.'}` };
      }
      if (response.status === 404) {
        return { error: `File not found (404). The URL may be incorrect or the file was deleted.` };
      }
      return { error: `Failed to fetch video: ${response.status} ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';

    // No content type validation - accept any downloadable content
    // The user knows what they're importing

    // Determine filename
    let fileName: string;
    if (customName && customName.trim() !== '') {
      // Use custom name, ensure it has an extension
      fileName = customName.trim();
      if (!fileName.includes('.')) {
        // Try to get extension from content type or default to mp4
        let ext = 'mp4';
        if (contentType.includes('/')) {
          const typePart = contentType.split('/')[1]?.split(';')[0];
          if (typePart && typePart.length <= 5) {
            ext = typePart;
          }
        }
        fileName += `.${ext}`;
      }
    } else {
      // Extract filename from URL or content-disposition
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          fileName = match[1].replace(/['"]/g, '');
        } else {
          fileName = parsedUrl.pathname.split('/').pop() || 'imported-video.mp4';
        }
      } else {
        fileName = parsedUrl.pathname.split('/').pop() || 'imported-video.mp4';
      }
    }

    // Sanitize filename
    fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!fileName.match(/\.(mp4|webm|mkv|avi|mov|wmv|flv|m4v)$/i)) {
      fileName += '.mp4';
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Stream the response body to Azure
    if (!response.body) {
      return { error: 'Failed to read video stream from URL.' };
    }

    const nodeStream = Readable.fromWeb(response.body as any);

    await blockBlobClient.uploadStream(nodeStream, undefined, undefined, {
      blobHTTPHeaders: { blobContentType: contentType.startsWith('video/') ? contentType : 'video/mp4' }
    });

    revalidatePath('/');
    return { success: `Successfully imported "${fileName}" from URL.` };

  } catch (e) {
    let errorMessage = 'An unknown error occurred during import.';
    if (e instanceof Error) {
      errorMessage = `Import failed: ${e.message}`;
    }
    console.error(errorMessage, e);
    return { error: errorMessage };
  }
}
