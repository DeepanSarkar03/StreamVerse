// Content script - Injects cookie capture into StreamVerse pages

// Only run on localhost/StreamVerse pages
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  
  // Expose a function for the page to request Google cookies
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'STREAMVERSE_GET_COOKIES') {
      const url = event.data.url;
      
      // Ask background script for cookies
      chrome.runtime.sendMessage({ action: 'getCookies', url }, (response) => {
        window.postMessage({
          type: 'STREAMVERSE_COOKIES_RESPONSE',
          cookies: response?.cookies || '',
          requestId: event.data.requestId,
        }, '*');
      });
    }
    
    if (event.data.type === 'STREAMVERSE_TURBO_DOWNLOAD') {
      const { url, fileName, requestId } = event.data;
      
      // Get cookies for this URL
      chrome.runtime.sendMessage({ action: 'getCookies', url }, async (cookieResponse) => {
        const cookies = cookieResponse?.cookies || '';
        
        // Send to proxy via background
        chrome.runtime.sendMessage({
          action: 'downloadWithCookies',
          url,
          fileName,
          cookies,
        }, (result) => {
          window.postMessage({
            type: 'STREAMVERSE_DOWNLOAD_RESULT',
            ...result,
            requestId,
          }, '*');
        });
      });
    }
  });
  
  // Inject indicator that extension is active
  const indicator = document.createElement('div');
  indicator.id = 'streamverse-turbo-indicator';
  indicator.style.cssText = 'display:none;';
  indicator.dataset.installed = 'true';
  document.body.appendChild(indicator);
  
  console.log('🚀 StreamVerse Turbo extension active');
}
