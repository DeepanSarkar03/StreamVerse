// Background service worker - handles cookie capture and message passing

// Get all cookies for Google domains
async function getGoogleCookies(url) {
  const domains = [
    '.google.com',
    '.googleusercontent.com', 
    '.googlevideo.com',
    '.youtube.com',
    'drive.google.com',
    'docs.google.com',
  ];
  
  const allCookies = [];
  
  for (const domain of domains) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      allCookies.push(...cookies);
    } catch (e) {
      console.log(`No cookies for ${domain}`);
    }
  }
  
  // Also try to get cookies for the specific URL
  try {
    const urlCookies = await chrome.cookies.getAll({ url });
    // Add unique cookies
    for (const cookie of urlCookies) {
      if (!allCookies.find(c => c.name === cookie.name && c.domain === cookie.domain)) {
        allCookies.push(cookie);
      }
    }
  } catch (e) {
    console.log('Could not get URL-specific cookies');
  }
  
  // Format as Cookie header string
  const cookieString = allCookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
    
  return cookieString;
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    getGoogleCookies(request.url).then(cookies => {
      sendResponse({ cookies });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'downloadWithCookies') {
    handleDownload(request.url, request.fileName, request.cookies).then(result => {
      sendResponse(result);
    });
    return true;
  }
});

// Handle the actual download via proxy
async function handleDownload(url, fileName, cookies) {
  const PROXY_URL = 'http://4.213.170.162:3000';
  const SECRET = 'df81ea76-37a1-4d00-aa08-24cb2ae56328';
  
  try {
    const response = await fetch(`${PROXY_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        fileName,
        secret: SECRET,
        cookies, // Pass the captured cookies!
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    
    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Inject content script to communicate with StreamVerse page
chrome.runtime.onInstalled.addListener(() => {
  console.log('StreamVerse Turbo Downloader installed');
});
