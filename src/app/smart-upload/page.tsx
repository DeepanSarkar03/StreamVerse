'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SmartUploadPage() {
  const router = useRouter();
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [watchUrl, setWatchUrl] = useState('');

  const handleUpload = async () => {
    if (uploadType === 'file' && !file) {
      setError('Please select a file');
      return;
    }
    if (uploadType === 'url' && !url) {
      setError('Please enter a URL');
      return;
    }
    if (!filename) {
      setError('Please enter a filename');
      return;
    }

    setUploading(true);
    setError('');
    setProgress('Starting upload...');

    try {
      const formData = new FormData();
      
      if (uploadType === 'file' && file) {
        formData.append('file', file);
      } else if (uploadType === 'url') {
        formData.append('url', url);
      }
      
      formData.append('filename', filename.endsWith('.mp4') ? filename : `${filename}.mp4`);

      setProgress('Uploading and analyzing...');
      
      const response = await fetch('/api/smart-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Upload failed');
      }

      setProgress('Complete!');
      setSuccess(true);
      setWatchUrl(data.watchUrl);
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push(data.watchUrl);
      }, 2000);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
      setProgress('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🚀 Smart Upload</h1>
        <p className="text-gray-400 mb-8">Upload any video - we'll automatically make it work in browsers</p>

        {!success ? (
          <>
            {/* Upload Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-3">Upload From:</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setUploadType('file')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    uploadType === 'file'
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  📁 Local File
                </button>
                <button
                  onClick={() => setUploadType('url')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    uploadType === 'url'
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  🔗 URL
                </button>
              </div>
            </div>

            {/* File Upload */}
            {uploadType === 'file' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Select Video File:</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    setFile(selectedFile || null);
                    if (selectedFile && !filename) {
                      setFilename(selectedFile.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                {file && (
                  <p className="mt-2 text-sm text-gray-400">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}

            {/* URL Upload */}
            {uploadType === 'url' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Video URL:</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-600 outline-none"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Supports: Direct video links, Google Drive, Dropbox, etc.
                </p>
              </div>
            )}

            {/* Filename */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-3">Movie Name:</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Extraction (2020)"
                className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-600 outline-none"
              />
              <p className="mt-2 text-sm text-gray-400">
                This will be the display name in your library
              </p>
            </div>

            {/* What Happens */}
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
              <h3 className="font-semibold mb-2">✨ What We'll Do:</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>✅ Analyze video codec compatibility</li>
                <li>✅ Auto-convert to H.264 if needed (browser-compatible)</li>
                <li>✅ Optimize for streaming (faststart)</li>
                <li>✅ Upload to Azure cloud storage</li>
                <li>✅ Guarantee it works in your browser</li>
              </ul>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Progress Display */}
            {uploading && (
              <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span>{progress}</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  This may take a few minutes for large files...
                </p>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
            >
              {uploading ? 'Processing...' : '🚀 Upload & Auto-Fix'}
            </button>
          </>
        ) : (
          <div className="p-8 bg-green-900/20 border border-green-500 rounded-lg text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">Upload Successful!</h2>
            <p className="text-gray-300 mb-6">Your video is ready to watch</p>
            <a
              href={watchUrl}
              className="inline-block py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              🎬 Watch Now
            </a>
            <p className="text-sm text-gray-400 mt-4">Redirecting automatically...</p>
          </div>
        )}

        <div className="mt-8">
          <a href="/" className="text-blue-400 hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}