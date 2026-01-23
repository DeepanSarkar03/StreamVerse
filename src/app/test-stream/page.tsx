'use client';

import { useState } from 'react';

export default function TestStreamPage() {
  const [videoId] = useState('Extraction (2020).mp4');
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testDirectBlob = async () => {
    addResult('🧪 Testing direct blob access...');
    try {
      const response = await fetch(`https://streamverse.blob.core.windows.net/movies/${encodeURIComponent(videoId)}`, {
        method: 'HEAD'
      });
      if (response.ok) {
        const size = response.headers.get('content-length');
        addResult(`✅ Direct blob works! Size: ${Math.round(parseInt(size || '0') / 1024 / 1024)}MB`);
      } else {
        addResult(`❌ Direct blob failed: ${response.status}`);
      }
    } catch (error) {
      addResult(`❌ Direct blob error: ${error}`);
    }
  };

  const testPlexStream = async () => {
    addResult('🧪 Testing Plex streaming API...');
    try {
      const response = await fetch(`/api/plex-stream/${encodeURIComponent(videoId)}`, {
        method: 'HEAD'
      });
      if (response.ok) {
        const cdnEnabled = response.headers.get('X-CDN-Enabled');
        const serverType = response.headers.get('X-Server-Type');
        addResult(`✅ Plex API works! CDN: ${cdnEnabled}, Server: ${serverType}`);
      } else {
        addResult(`❌ Plex API failed: ${response.status}`);
      }
    } catch (error) {
      addResult(`❌ Plex API error: ${error}`);
    }
  };

  const testVideoPlayback = () => {
    addResult('🧪 Testing video element playback...');
    const video = document.createElement('video');
    video.src = `/api/plex-stream/${encodeURIComponent(videoId)}`;
    
    video.onloadstart = () => addResult('📡 Video loading started...');
    video.onloadedmetadata = () => addResult(`✅ Video metadata loaded! Duration: ${video.duration.toFixed(1)}s`);
    video.oncanplay = () => addResult('🚀 Video ready to play!');
    video.onerror = (e) => {
      const error = video.error;
      addResult(`❌ Video error: Code ${error?.code} - ${error?.message}`);
    };
    
    // Don't actually play, just test loading
    video.preload = 'metadata';
    video.load();
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 StreamVerse Diagnostics</h1>
        
        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Video: {videoId}</h2>
          
          <div className="space-x-4 mb-6">
            <button 
              onClick={testDirectBlob}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              Test Direct Blob
            </button>
            <button 
              onClick={testPlexStream}
              className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded"
            >
              Test Plex API
            </button>
            <button 
              onClick={testVideoPlayback}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              Test Video Element
            </button>
            <button 
              onClick={() => setTestResults([])}
              className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
            >
              Clear Results
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Test Results:</h3>
          <div className="bg-black p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No tests run yet. Click a test button above.</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">{result}</div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8">
          <a 
            href={`/watch/${encodeURIComponent(videoId)}`}
            className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg inline-block"
          >
            🎬 Watch Movie (Plex Player)
          </a>
        </div>
      </div>
    </div>
  );
}