# StreamVerse Turbo Downloader Chrome Extension

This Chrome extension enables **datacenter-speed downloads** (1-10+ Gbps) for authenticated URLs like Google Drive, Google Docs, and YouTube by capturing your browser's cookies and forwarding them to the Azure VM proxy.

## Why is this needed?

Google/YouTube URLs require authentication (cookies) to download. Your browser has these cookies, but:
- The server can't access browser cookies (security restriction)
- CORS blocks direct downloads from the browser
- The Azure VM proxy doesn't have your Google account session

This extension bridges the gap by:
1. Capturing your Google cookies from the browser
2. Sending them securely to the Azure VM proxy
3. The proxy uses YOUR credentials to download at datacenter speed (not your slow home internet)

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this `chrome-extension` folder
5. The extension icon should appear in your toolbar

## Creating Icons

Before loading, you need PNG icons. Create these files:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

Quick way using ImageMagick:
```bash
convert -size 16x16 xc:#8b5cf6 icon16.png
convert -size 48x48 xc:#8b5cf6 icon48.png
convert -size 128x128 xc:#8b5cf6 icon128.png
```

Or just create simple purple square PNGs in any image editor.

## Usage

### Method 1: Extension Popup (Standalone)
1. Click the extension icon in Chrome toolbar
2. Paste a Google/YouTube URL
3. Enter a custom filename (optional)
4. Click "⚡ Turbo Download with Cookies"
5. Watch the progress - should see 100+ MB/s speeds!

### Method 2: Integrated with StreamVerse (Coming Soon)
The extension injects a content script that allows the StreamVerse page to request cookies for authenticated downloads.

## How it Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Browser                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ StreamVerse Turbo Extension                                 │ │
│  │  • Captures Google cookies via chrome.cookies API          │ │
│  │  • Sends cookies + URL to Azure VM proxy                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ POST /download { url, cookies }
                      │ (Your slow internet, but just a tiny request)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure VM (Central India)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Proxy Server (74.225.242.226:3000)                         │ │
│  │  • Downloads FROM Google using YOUR cookies                │ │
│  │  • 1-10+ Gbps Azure datacenter speed!                      │ │
│  │  • Uploads directly TO Azure Blob Storage                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Block upload (internal Azure network)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Blob Storage (streamverse/movies)             │
│               Your video is stored at 10+ Gbps!                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Notes

- Cookies are only captured for Google domains
- Cookies are sent to YOUR Azure VM (not any third party)
- The proxy secret prevents unauthorized access
- Cookies are not stored - only used for the single download

## Troubleshooting

### "No Google cookies found"
- Make sure you're logged into Google in this Chrome profile
- Visit google.com and make sure you're signed in

### "Proxy offline"
- Check that the Azure VM is running
- SSH to the VM and run `pm2 status`
- Restart with `pm2 restart streamverse-proxy`

### Still slow downloads?
- Check proxy logs: `pm2 logs streamverse-proxy`
- Verify the cookie is being passed (check for "Cookie" header in logs)
