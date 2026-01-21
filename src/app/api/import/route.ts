import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { Readable } from 'stream';

// Azure Function configuration for datacenter-speed downloads
const AZURE_FUNCTION_URL = process.env.AZURE_FUNCTION_URL;
const AZURE_FUNCTION_SECRET = process.env.AZURE_FUNCTION_SECRET;

// Proxy VM for authenticated URLs (Google, etc.)
const PROXY_VM_URL = process.env.PROXY_VM_URL;
const PROXY_VM_SECRET = process.env.PROXY_VM_SECRET;

// Convert sharing URLs from various services to direct download URLs
function convertToDirectUrl(url: string): { url: string; service: string | null } {
  const urlLower = url.toLowerCase();
  
  // Google Drive
  if (urlLower.includes('drive.google.com')) {
    let fileId: string | null = null;
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }
    if (!fileId) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        fileId = idMatch[1];
      }
    }
    if (fileId) {
      return { 
        url: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        service: 'Google Drive'
      };
    }
  }
  
  // OneDrive / SharePoint
  if (urlLower.includes('1drv.ms') || urlLower.includes('onedrive.live.com') || urlLower.includes('sharepoint.com')) {
    if (urlLower.includes('1drv.ms')) {
      return { 
        url: `${url.split('?')[0]}?download=1`,
        service: 'OneDrive'
      };
    }
    const separator = url.includes('?') ? '&' : '?';
    return { 
      url: `${url}${separator}download=1`,
      service: 'OneDrive'
    };
  }
  
  // Dropbox
  if (urlLower.includes('dropbox.com')) {
    let directUrl = url.replace(/dl=0/, 'dl=1');
    if (!directUrl.includes('dl=1')) {
      const separator = directUrl.includes('?') ? '&' : '?';
      directUrl = `${directUrl}${separator}dl=1`;
    }
    return { url: directUrl, service: 'Dropbox' };
  }
  
  // Mega.nz
  if (urlLower.includes('mega.nz') || urlLower.includes('mega.co.nz')) {
    return { url, service: 'Mega' };
  }
  
  // MediaFire
  if (urlLower.includes('mediafire.com/file/')) {
    return { url, service: 'MediaFire' };
  }
  
  // pCloud
  if (urlLower.includes('pcloud.com')) {
    const separator = url.includes('?') ? '&' : '?';
    return { 
      url: `${url}${separator}forcedownload=1`,
      service: 'pCloud'
    };
  }

  // GitHub raw files
  if (urlLower.includes('github.com') && !urlLower.includes('raw.githubusercontent.com')) {
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    return { url: rawUrl, service: 'GitHub' };
  }

  // Box.com
  if (urlLower.includes('box.com/s/')) {
    const directUrl = url.replace('/s/', '/shared/static/');
    return { url: directUrl, service: 'Box' };
  }
  
  return { url, service: null };
}

// URLs that require authentication/cookies and can't be fetched by Azure directly
function requiresAuthentication(url: string): boolean {
  const authRequiredDomains = [
    'googleusercontent.com',
    'googlevideo.com',
    'youtube.com',
    'drive.google.com',
    'docs.google.com',
    'lh3.googleusercontent.com',
    'video-downloads.googleusercontent.com',
    'redirector.googlevideo.com',
  ];
  
  const urlLower = url.toLowerCase();
  return authRequiredDomains.some(domain => urlLower.includes(domain));
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: { progress?: number; status: string; error?: string; success?: boolean; fileName?: string }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { url, customName } = await request.json();

        if (!url || url.trim() === '') {
          sendProgress({ status: 'error', error: 'Please enter a valid URL.' });
          controller.close();
          return;
        }

        // Validate URL format
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            sendProgress({ status: 'error', error: 'Only HTTP and HTTPS URLs are supported.' });
            controller.close();
            return;
          }
        } catch {
          sendProgress({ status: 'error', error: 'Please enter a valid URL.' });
          controller.close();
          return;
        }

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

        if (!connectionString || !containerName) {
          sendProgress({ status: 'error', error: 'Azure Storage environment variables are not set.' });
          controller.close();
          return;
        }

        // Convert URL if needed
        const { url: directUrl, service } = convertToDirectUrl(url);
        sendProgress({ progress: 5, status: `Connecting to ${service || 'server'}...` });

        // First, do a HEAD request to get file info and check if URL is publicly accessible
        let contentLength = 0;
        let contentType = 'video/mp4';
        let isPublicUrl = false;
        let finalUrl = directUrl;

        try {
          const headResponse = await fetch(directUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'follow',
          });
          
          if (headResponse.ok) {
            contentLength = parseInt(headResponse.headers.get('content-length') || '0', 10);
            contentType = headResponse.headers.get('content-type') || 'video/mp4';
            finalUrl = headResponse.url; // Get the final URL after redirects
            isPublicUrl = true;
          }
        } catch {
          // HEAD failed, we'll try GET later
        }

        // Determine filename
        let fileName: string;
        if (customName && customName.trim() !== '') {
          fileName = customName.trim();
          if (!fileName.includes('.')) {
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
          fileName = parsedUrl.pathname.split('/').pop() || 'imported-video.mp4';
        }

        // Sanitize filename
        fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!fileName.match(/\.\w{2,5}$/)) {
          fileName += '.mp4';
        }

        // Check if URL requires authentication (can't use Azure-side copy)
        const needsAuth = requiresAuthentication(directUrl) || requiresAuthentication(finalUrl);

        // ============================================================
        // STRATEGY 0A: Proxy VM (for authenticated URLs like Google)
        // VM downloads with passed cookies at datacenter speed
        // ============================================================
        if (needsAuth && PROXY_VM_URL && PROXY_VM_SECRET) {
          sendProgress({ progress: 5, status: '⚡ Datacenter proxy: Authenticated download...' });

          try {
            const startResponse = await fetch(`${PROXY_VM_URL}/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: directUrl,
                fileName,
                secret: PROXY_VM_SECRET,
                // Note: Can pass cookies here if captured from client
              }),
            });

            if (startResponse.ok) {
              const { jobId } = await startResponse.json();
              sendProgress({ progress: 10, status: '⚡ Proxy downloading at datacenter speed...' });

              // Poll for progress
              let lastProgress = 0;
              let stuckCount = 0;

              while (true) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await fetch(
                  `${PROXY_VM_URL}/status/${jobId}?secret=${PROXY_VM_SECRET}`
                );

                if (!statusResponse.ok) {
                  throw new Error('Failed to check proxy status');
                }

                const job = await statusResponse.json();

                if (job.status === 'completed') {
                  sendProgress({ progress: 100, status: 'Complete!', success: true, fileName: job.fileName });
                  controller.close();
                  return;
                }

                if (job.status === 'error') {
                  throw new Error(job.error || 'Proxy download failed');
                }

                const progress = 10 + Math.round(job.progress * 0.85);
                const sizeMB = (job.downloadedSize / (1024 * 1024)).toFixed(1);
                const totalMB = (job.totalSize / (1024 * 1024)).toFixed(1);
                const speedMB = job.speed.toFixed(1);

                sendProgress({
                  progress,
                  status: `⚡ Proxy: ${sizeMB}MB / ${totalMB}MB (${speedMB} MB/s)`
                });

                if (job.progress === lastProgress) {
                  stuckCount++;
                  if (stuckCount >= 60) throw new Error('Proxy download stalled');
                } else {
                  stuckCount = 0;
                  lastProgress = job.progress;
                }
              }
            }
          } catch (proxyError: any) {
            console.log('Proxy VM failed, trying Azure Function:', proxyError.message);
            sendProgress({ progress: 5, status: 'Proxy unavailable, trying other methods...' });
          }
        }

        // ============================================================
        // STRATEGY 0B: Azure Function (DATACENTER SPEED for public files)
        // The function runs IN Azure, downloads at 10+ Gbps
        // ============================================================
        if (AZURE_FUNCTION_URL && AZURE_FUNCTION_SECRET && !needsAuth) {
          sendProgress({ progress: 5, status: '⚡ Datacenter mode: Dispatching to Azure...' });

          try {
            // Start the download job on Azure Function
            const startResponse = await fetch(`${AZURE_FUNCTION_URL}/api/download/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: directUrl,
                fileName,
                secret: AZURE_FUNCTION_SECRET,
              }),
            });

            if (startResponse.ok) {
              const { jobId } = await startResponse.json();
              sendProgress({ progress: 10, status: '⚡ Download running in Azure datacenter...' });

              // Poll for progress
              let lastProgress = 0;
              let stuckCount = 0;
              const maxStuckCount = 30; // 30 seconds without progress = fallback

              while (true) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1s

                const statusResponse = await fetch(
                  `${AZURE_FUNCTION_URL}/api/download/status/${jobId}?secret=${AZURE_FUNCTION_SECRET}`
                );

                if (!statusResponse.ok) {
                  throw new Error('Failed to check status');
                }

                const job = await statusResponse.json();

                if (job.status === 'completed') {
                  sendProgress({ progress: 100, status: 'Complete!', success: true, fileName });
                  controller.close();
                  return;
                }

                if (job.status === 'error') {
                  throw new Error(job.error || 'Download failed in Azure');
                }

                // Update progress
                const progress = 10 + Math.round(job.progress * 0.85);
                const sizeMB = (job.downloadedSize / (1024 * 1024)).toFixed(1);
                const totalMB = (job.totalSize / (1024 * 1024)).toFixed(1);
                const speedMB = job.speed.toFixed(1);

                sendProgress({
                  progress,
                  status: `⚡ Datacenter: ${sizeMB}MB / ${totalMB}MB (${speedMB} MB/s)`
                });

                // Check if stuck
                if (job.progress === lastProgress) {
                  stuckCount++;
                  if (stuckCount >= maxStuckCount) {
                    throw new Error('Download stalled');
                  }
                } else {
                  stuckCount = 0;
                  lastProgress = job.progress;
                }
              }
            }
          } catch (funcError: any) {
            console.log('Azure Function failed, falling back:', funcError.message);
            sendProgress({ progress: 10, status: 'Datacenter unavailable, using direct streaming...' });
          }
        }

        // Setup Azure client (for fallback strategies)
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        // ============================================================
        // STRATEGY 1: Azure-side copy (fast for truly public URLs only)
        // Skip for authenticated URLs like Google Drive, YouTube, etc.
        // ============================================================
        if (isPublicUrl && !needsAuth) {
          sendProgress({ progress: 10, status: '🚀 Ultra-fast mode: Azure is downloading directly...' });

          try {
            // Start async copy - Azure fetches the file directly
            // Add a 30-second timeout for the copy to start showing progress
            const copyPromise = blockBlobClient.beginCopyFromURL(finalUrl, {
              onProgress: (state) => {
                if (contentLength > 0 && state.copyProgress) {
                  const [copied, total] = state.copyProgress.split('/').map(Number);
                  if (total > 0) {
                    const progress = 10 + Math.round((copied / total) * 85);
                    const copiedMB = (copied / (1024 * 1024)).toFixed(1);
                    const totalMB = (total / (1024 * 1024)).toFixed(1);
                    sendProgress({ 
                      progress, 
                      status: `🚀 Azure downloading: ${copiedMB}MB / ${totalMB}MB` 
                    });
                  }
                }
              },
            });

            // Add timeout - if no progress after 30 seconds, abort and fall back
            const timeoutPromise = new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 30000);
            });

            sendProgress({ progress: 15, status: '🚀 Azure is fetching at datacenter speed...' });
            
            const copyPoller = await Promise.race([copyPromise, timeoutPromise]);
            
            if (!copyPoller) {
              // Timeout - Azure copy not working
              sendProgress({ progress: 15, status: 'Azure direct copy timed out, using streaming...' });
            } else {
              // Try to poll with timeout
              const pollTimeout = new Promise<null>((resolve) => {
                setTimeout(() => resolve(null), 60000); // 60s to show some progress
              });
              
              const result = await Promise.race([copyPoller.pollUntilDone(), pollTimeout]);
              
              if (result && result.copyStatus === 'success') {
                sendProgress({ progress: 100, status: 'Complete!', success: true, fileName });
                controller.close();
                return;
              } else if (result) {
                // Copy failed
                sendProgress({ progress: 15, status: 'Azure copy failed, using streaming...' });
              } else {
                // Timeout during polling
                try {
                  const state = copyPoller.getOperationState();
                  if (state.result?.copyId) {
                    await blockBlobClient.abortCopyFromURL(state.result.copyId);
                  }
                } catch {}
                sendProgress({ progress: 15, status: 'Azure copy too slow, switching to streaming...' });
              }
            }
          } catch (copyError: any) {
            // Azure copy failed (URL might require auth), fall back to streaming
            console.log('Azure copy failed, falling back to streaming:', copyError.message);
            sendProgress({ progress: 15, status: 'Falling back to streaming mode...' });
          }
        } else if (needsAuth) {
          sendProgress({ progress: 10, status: 'Authenticated URL detected, using streaming mode...' });
        }

        // ============================================================
        // STRATEGY 2: Streaming upload (for authenticated URLs)
        // ============================================================
        sendProgress({ progress: 15, status: `Streaming "${fileName}" to Azure...` });

        const startTime = Date.now();

        // Fetch the file
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 600000); // 10 min timeout

        let response: Response;
        try {
          response = await fetch(directUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Accept-Encoding': 'identity',
            },
            signal: abortController.signal,
            redirect: 'follow',
          });
        } catch (fetchError: any) {
          clearTimeout(timeout);
          if (fetchError.name === 'AbortError') {
            sendProgress({ status: 'error', error: 'Request timed out.' });
          } else {
            sendProgress({ status: 'error', error: `Failed to connect: ${fetchError.message}` });
          }
          controller.close();
          return;
        }
        clearTimeout(timeout);

        if (!response.ok) {
          sendProgress({ status: 'error', error: `Failed to fetch: ${response.status} ${response.statusText}` });
          controller.close();
          return;
        }

        const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
        contentType = response.headers.get('content-type') || contentType;

        const reader = response.body?.getReader();
        if (!reader) {
          sendProgress({ status: 'error', error: 'Failed to read response stream.' });
          controller.close();
          return;
        }

        // Create progress tracking stream
        let uploadedSize = 0;
        let lastProgressUpdate = Date.now();

        const progressStream = new ReadableStream({
          async pull(streamController) {
            const { done, value } = await reader.read();
            
            if (done) {
              streamController.close();
              return;
            }

            uploadedSize += value.length;
            
            const now = Date.now();
            if (now - lastProgressUpdate > 1000) {
              lastProgressUpdate = now;
              if (totalSize > 0) {
                const progress = 15 + Math.round((uploadedSize / totalSize) * 80);
                const sizeMB = (uploadedSize / (1024 * 1024)).toFixed(1);
                const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
                const elapsedSec = (now - startTime) / 1000;
                const speedMBps = (uploadedSize / (1024 * 1024)) / elapsedSec;
                sendProgress({ 
                  progress, 
                  status: `Uploading: ${sizeMB}MB / ${totalMB}MB (${speedMBps.toFixed(1)} MB/s)` 
                });
              } else {
                const sizeMB = (uploadedSize / (1024 * 1024)).toFixed(1);
                sendProgress({ progress: 50, status: `Uploading: ${sizeMB}MB` });
              }
            }

            streamController.enqueue(value);
          },
          cancel() {
            reader.cancel();
          }
        }, { highWaterMark: 4 * 1024 * 1024 });

        const nodeStream = Readable.fromWeb(progressStream as any);

        await blockBlobClient.uploadStream(
          nodeStream,
          8 * 1024 * 1024,
          4,
          {
            blobHTTPHeaders: { 
              blobContentType: contentType.startsWith('video/') ? contentType : 'video/mp4' 
            }
          }
        );

        sendProgress({ progress: 100, status: 'Complete!', success: true, fileName });
        
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        sendProgress({ status: 'error', error: errorMessage });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
