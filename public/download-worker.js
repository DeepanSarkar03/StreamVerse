// Web Worker for high-speed browser-side downloads
// Downloads using browser credentials, uploads chunks in parallel to Azure

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
const MAX_PARALLEL_UPLOADS = 6;

let uploadId = null;
let pendingChunks = [];
let activeUploads = 0;
let blockIndex = 0;
let uploadedSize = 0;
let totalSize = 0;
let startTime = 0;
let isComplete = false;

async function uploadChunk(chunk, blockIdx) {
  const blockId = btoa(String(blockIdx).padStart(6, '0'));
  
  const response = await fetch('/api/stream-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: JSON.stringify({
      action: 'chunk',
      uploadId,
      blockId,
      chunk: arrayBufferToBase64(chunk),
    }),
  });
  
  if (!response.ok) {
    throw new Error('Chunk upload failed');
  }
  
  return response.json();
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function processUploadQueue() {
  while (pendingChunks.length > 0 && activeUploads < MAX_PARALLEL_UPLOADS) {
    const { chunk, index } = pendingChunks.shift();
    activeUploads++;
    
    uploadChunk(chunk, index)
      .then((result) => {
        uploadedSize += chunk.byteLength;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (uploadedSize / (1024 * 1024)) / elapsed : 0;
        const progress = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
        
        self.postMessage({
          type: 'progress',
          uploadedSize,
          totalSize,
          speed,
          progress,
        });
      })
      .catch((error) => {
        self.postMessage({ type: 'error', error: error.message });
      })
      .finally(() => {
        activeUploads--;
        processUploadQueue();
      });
  }
  
  if (pendingChunks.length === 0 && activeUploads === 0 && isComplete) {
    completeUpload();
  }
}

async function completeUpload() {
  try {
    const response = await fetch('/api/stream-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', uploadId }),
    });
    
    if (!response.ok) throw new Error('Failed to complete upload');
    
    const result = await response.json();
    self.postMessage({ type: 'complete', fileName: result.fileName });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
}

self.onmessage = async function(e) {
  const { type, url, fileName, contentType, size } = e.data;
  
  if (type === 'start') {
    try {
      startTime = Date.now();
      totalSize = size || 0;
      
      // Initialize upload session
      const initRes = await fetch('/api/stream-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          fileName,
          contentType: contentType || 'video/mp4',
          totalSize,
        }),
      });
      
      if (!initRes.ok) throw new Error('Failed to init upload');
      const initData = await initRes.json();
      uploadId = initData.uploadId;
      
      self.postMessage({ type: 'initialized', uploadId });
      
      // Start downloading
      const response = await fetch(url, {
        credentials: 'include',
        mode: 'cors',
      });
      
      if (!response.ok) {
        // Try no-cors as fallback
        const fallback = await fetch(url);
        if (!fallback.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }
      }
      
      totalSize = parseInt(response.headers.get('content-length') || '0', 10) || totalSize;
      
      const reader = response.body.getReader();
      let buffer = new Uint8Array(0);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          // Append to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
        }
        
        // Queue chunks for upload
        while (buffer.length >= CHUNK_SIZE) {
          const chunk = buffer.slice(0, CHUNK_SIZE);
          buffer = buffer.slice(CHUNK_SIZE);
          pendingChunks.push({ chunk: chunk.buffer, index: blockIndex++ });
          processUploadQueue();
        }
        
        if (done) {
          // Upload remaining buffer
          if (buffer.length > 0) {
            pendingChunks.push({ chunk: buffer.buffer, index: blockIndex++ });
          }
          isComplete = true;
          processUploadQueue();
          break;
        }
      }
    } catch (error) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
};
