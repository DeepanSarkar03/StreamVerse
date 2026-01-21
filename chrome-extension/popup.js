// Popup script for StreamVerse Turbo extension

const PROXY_URL = 'http://4.213.170.162:3000';
const SECRET = 'df81ea76-37a1-4d00-aa08-24cb2ae56328';

let capturedCookies = '';

// Check proxy connection and cookie count on popup open
document.addEventListener('DOMContentLoaded', async () => {
  // Check proxy
  try {
    const res = await fetch(`${PROXY_URL}/health`, { method: 'GET' });
    if (res.ok) {
      document.getElementById('status').className = 'status connected';
      document.getElementById('status').textContent = '✅ Proxy connected - Ready for high-speed downloads';
    }
  } catch (e) {
    document.getElementById('status').className = 'status disconnected';
    document.getElementById('status').textContent = '❌ Proxy offline - Check VM status';
  }
  
  // Get Google cookies count
  chrome.runtime.sendMessage({ action: 'getCookies', url: 'https://drive.google.com' }, (response) => {
    if (response && response.cookies) {
      capturedCookies = response.cookies;
      const count = capturedCookies ? capturedCookies.split(';').length : 0;
      document.getElementById('cookieCount').textContent = `🍪 Found ${count} Google cookies for authentication`;
      
      if (count === 0) {
        document.getElementById('cookieCount').textContent = '⚠️ No Google cookies found - Log into Google first!';
      }
    }
  });
});

// Download button handler
document.getElementById('downloadBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  const customName = document.getElementById('nameInput').value.trim();
  
  if (!url) {
    showResult('Please enter a URL', 'error');
    return;
  }
  
  const btn = document.getElementById('downloadBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Downloading...';
  
  const progressContainer = document.getElementById('progressContainer');
  progressContainer.style.display = 'block';
  
  const progressText = document.getElementById('progressText');
  progressText.textContent = 'Sending to proxy with cookies...';
  
  try {
    // Get fresh cookies
    const cookieResponse = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getCookies', url }, resolve);
    });
    
    const cookies = cookieResponse?.cookies || capturedCookies;
    
    // Generate filename
    let fileName = customName || url.split('/').pop()?.split('?')[0] || 'download';
    if (!fileName.includes('.')) {
      fileName += '.mp4';
    }
    // Sanitize filename
    fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    progressText.textContent = `Uploading to Azure at datacenter speed...`;
    
    // Send to proxy
    const response = await fetch(`${PROXY_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        fileName,
        secret: SECRET,
        cookies, // The magic - passing your Google cookies!
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    
    const { jobId } = await response.json();
    
    // Poll for completion
    let result;
    while (true) {
      await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
      
      const statusRes = await fetch(`${PROXY_URL}/status/${jobId}?secret=${SECRET}`);
      if (!statusRes.ok) throw new Error('Failed to get status');
      
      result = await statusRes.json();
      
      const progressFill = document.getElementById('progressFill');
      progressFill.style.width = `${result.progress}%`;
      
      if (result.speed > 0) {
        progressText.textContent = `⚡ ${result.speed.toFixed(1)} MB/s - ${formatBytes(result.downloadedSize)} / ${formatBytes(result.totalSize)}`;
      }
      
      if (result.status === 'completed') break;
      if (result.status === 'error') throw new Error(result.error || 'Download failed');
    }
    
    progressText.textContent = 'Complete!';
    
    showResult(`✅ Uploaded: ${result.fileName} (${formatBytes(result.downloadedSize)}) at ${result.speed.toFixed(1)} MB/s!`, 'success');
    
  } catch (error) {
    showResult(`❌ Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⚡ Turbo Download with Cookies';
  }
});

function showResult(message, type) {
  const resultEl = document.getElementById('result');
  resultEl.style.display = 'block';
  resultEl.className = `result ${type}`;
  resultEl.textContent = message;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
