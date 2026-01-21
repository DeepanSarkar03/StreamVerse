import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Configuration - SET THESE!
const SECRET = process.env.PROXY_SECRET || 'CHANGE_THIS_SECRET';
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER_NAME || 'movies';

// In-memory job tracking
const jobs = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', jobs: jobs.size });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start a download job
app.post('/download', async (req, res) => {
  const { url, fileName, cookies, headers, secret, accessToken } = req.body;
  
  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (!url || !fileName) {
    return res.status(400).json({ error: 'url and fileName required' });
  }
  
  if (!AZURE_CONNECTION_STRING) {
    return res.status(500).json({ error: 'Azure storage not configured' });
  }
  
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  const job = {
    id: jobId,
    status: 'starting',
    progress: 0,
    speed: 0,
    downloadedSize: 0,
    totalSize: 0,
    fileName,
    error: null,
  };
  jobs.set(jobId, job);
  
  // Start download in background
  downloadAndUpload(jobId, url, fileName, cookies, headers, accessToken).catch(err => {
    const j = jobs.get(jobId);
    if (j) {
      j.status = 'error';
      j.error = err.message;
    }
  });
  
  res.json({ jobId, status: 'started' });
});

// Check job status
app.get('/status/:jobId', (req, res) => {
  const { secret } = req.query;
  
  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
  
  // Clean up completed jobs after 5 minutes
  if (job.status === 'completed' || job.status === 'error') {
    setTimeout(() => jobs.delete(job.id), 5 * 60 * 1000);
  }
});

async function downloadAndUpload(jobId, url, fileName, cookies, customHeaders, accessToken) {
  const job = jobs.get(jobId);
  job.status = 'downloading';
  
  // Convert Google Drive share URL to direct download URL
  let downloadUrl = url;
  if (url.includes('drive.google.com') && accessToken) {
    // Extract file ID from various Google Drive URL formats
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      // Use Google Drive API with access token
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }
  }
  
  // Build headers
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    ...customHeaders,
  };
  
  // Use access token for Google APIs (OAuth)
  if (accessToken && downloadUrl.includes('googleapis.com')) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (cookies) {
    // Fallback to cookies for non-API URLs
    headers['Cookie'] = cookies;
  }
  
  // Fetch the file
  const response = await fetch(downloadUrl, { headers, redirect: 'follow' });
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const contentType = response.headers.get('content-type') || 'video/mp4';
  job.totalSize = contentLength;
  
  // Setup Azure
  const blobService = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
  const container = blobService.getContainerClient(AZURE_CONTAINER);
  await container.createIfNotExists();
  
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blockBlob = container.getBlockBlobClient(sanitizedName);
  job.fileName = sanitizedName;
  
  // Stream with block uploads for speed
  const reader = response.body.getReader();
  const BLOCK_SIZE = 4 * 1024 * 1024; // 4MB blocks
  const MAX_PARALLEL = 8;
  
  let buffer = Buffer.alloc(0);
  let blockIndex = 0;
  const blockIds = [];
  const pendingUploads = [];
  const startTime = Date.now();
  
  const uploadBlock = async (data, idx) => {
    // Block ID must be consistent length - use fixed 8 char padded, then base64
    const blockIdStr = `block${String(idx).padStart(10, '0')}`;
    const blockId = Buffer.from(blockIdStr).toString('base64');
    await blockBlob.stageBlock(blockId, data, data.length);
    return { idx, blockId };
  };
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (value) {
      buffer = Buffer.concat([buffer, Buffer.from(value)]);
      job.downloadedSize += value.length;
      
      const elapsed = (Date.now() - startTime) / 1000;
      job.speed = elapsed > 0 ? (job.downloadedSize / (1024 * 1024)) / elapsed : 0;
      job.progress = job.totalSize > 0 ? (job.downloadedSize / job.totalSize) * 100 : 0;
    }
    
    // Upload complete blocks
    while (buffer.length >= BLOCK_SIZE || (done && buffer.length > 0)) {
      const blockData = buffer.slice(0, BLOCK_SIZE);
      buffer = buffer.slice(BLOCK_SIZE);
      
      const idx = blockIndex++;
      
      // Limit parallel uploads
      if (pendingUploads.length >= MAX_PARALLEL) {
        const completed = await Promise.race(pendingUploads);
        blockIds[completed.idx] = completed.blockId;
        pendingUploads.splice(pendingUploads.findIndex(p => p === completed), 1);
      }
      
      const uploadPromise = uploadBlock(blockData, idx);
      uploadPromise.then(result => {
        blockIds[result.idx] = result.blockId;
      });
      pendingUploads.push(uploadPromise);
      
      if (done && buffer.length === 0) break;
    }
    
    if (done) break;
  }
  
  // Wait for remaining uploads
  const results = await Promise.all(pendingUploads);
  results.forEach(r => { blockIds[r.idx] = r.blockId; });
  
  // Commit all blocks
  const validBlockIds = blockIds.filter(id => id);
  await blockBlob.commitBlockList(validBlockIds, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  
  job.status = 'completed';
  job.progress = 100;
  
  console.log(`✅ ${sanitizedName}: ${(job.downloadedSize / (1024 * 1024)).toFixed(1)}MB at ${job.speed.toFixed(1)} MB/s`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 StreamVerse Proxy running on port ${PORT}`);
  console.log(`   Datacenter speed: 1-10+ Gbps`);
});
