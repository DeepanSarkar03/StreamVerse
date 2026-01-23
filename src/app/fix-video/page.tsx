'use client';

export default function FixVideoPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔧 Fix Your Video File</h1>
        
        <div className="bg-red-900/20 border border-red-500 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">❌ Current Issue</h2>
          <p>Your "Extraction (2020).mp4" file is not playing in browsers. This means the codec is incompatible.</p>
        </div>

        <div className="bg-blue-900/20 border border-blue-500 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">✅ Solution: Re-convert with Browser-Compatible Settings</h2>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">Step 1: Download Your Current File</h3>
          <p className="mb-2">Download the file from Azure to re-convert it:</p>
          <div className="bg-black p-4 rounded font-mono text-sm mb-4">
            <a 
              href="https://streamverse.blob.core.windows.net/movies/Extraction%20(2020).mp4"
              className="text-blue-400 underline"
              download
            >
              Download Extraction (2020).mp4
            </a>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">Step 2: Convert with FFmpeg (Browser-Compatible)</h3>
          <p className="mb-2">Use this command to create a browser-compatible MP4:</p>
          <div className="bg-black p-4 rounded font-mono text-sm overflow-x-auto">
            ffmpeg -i "Extraction (2020).mp4" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "Extraction (2020) - Web.mp4"
          </div>
          
          <div className="mt-4 space-y-2 text-sm text-gray-300">
            <p><strong>-c:v libx264</strong> - Use H.264 codec (universally supported)</p>
            <p><strong>-profile:v baseline</strong> - Maximum compatibility</p>
            <p><strong>-pix_fmt yuv420p</strong> - Standard pixel format</p>
            <p><strong>-c:a aac</strong> - AAC audio (universally supported)</p>
            <p><strong>-movflags +faststart</strong> - Enable streaming (critical!)</p>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">Step 3: Upload to Azure</h3>
          <p className="mb-2">Upload the new file to Azure Storage:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Go to Azure Portal → Storage Account → "movies" container</li>
            <li>Delete the old "Extraction (2020).mp4"</li>
            <li>Upload "Extraction (2020) - Web.mp4"</li>
            <li>Rename it to "Extraction (2020).mp4"</li>
          </ol>

          <h3 className="text-lg font-semibold mt-6 mb-3">Alternative: Use HandBrake (GUI)</h3>
          <p className="mb-2">If you prefer a GUI:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Download HandBrake: <a href="https://handbrake.fr/" className="text-blue-400 underline" target="_blank">handbrake.fr</a></li>
            <li>Open your video file</li>
            <li>Select preset: "Web" → "Gmail Large 3 Minutes 720p30"</li>
            <li>Click "Start Encode"</li>
            <li>Upload the result to Azure</li>
          </ol>
        </div>

        <div className="bg-green-900/20 border border-green-500 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">🎯 Why This Matters</h2>
          <p className="mb-4">Browsers are very picky about video codecs. Your current file likely has:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>HEVC/H.265 codec (not supported in most browsers)</li>
            <li>10-bit color depth (not supported)</li>
            <li>Missing "faststart" flag (can't stream)</li>
            <li>Incompatible audio codec</li>
          </ul>
          <p className="mt-4">The command above fixes all of these issues.</p>
        </div>

        <div className="mt-8">
          <a 
            href="/"
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg inline-block"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}