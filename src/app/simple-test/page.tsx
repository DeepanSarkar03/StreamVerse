'use client';

export default function SimpleTestPage() {
  const videoUrl = "https://streamverse.blob.core.windows.net/movies/Extraction%20(2020).mp4";
  
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-4">Simple Video Test</h1>
      
      <div className="mb-4">
        <p>Direct URL: <a href={videoUrl} className="text-blue-400 underline" target="_blank">{videoUrl}</a></p>
      </div>
      
      <video 
        controls 
        width="800" 
        height="450"
        className="bg-gray-800"
        onError={(e) => console.error('Video error:', e)}
        onLoadStart={() => console.log('Video loading started')}
        onCanPlay={() => console.log('Video can play')}
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      <div className="mt-4">
        <button 
          onClick={() => {
            const video = document.querySelector('video') as HTMLVideoElement;
            if (video) {
              video.load();
              console.log('Video reloaded');
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-4"
        >
          Reload Video
        </button>
        
        <button 
          onClick={() => {
            fetch(videoUrl, { method: 'HEAD' })
              .then(response => {
                console.log('Fetch test:', response.status, response.headers.get('content-type'));
                alert(`Status: ${response.status}, Type: ${response.headers.get('content-type')}`);
              })
              .catch(error => {
                console.error('Fetch error:', error);
                alert(`Fetch failed: ${error.message}`);
              });
          }}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
        >
          Test URL
        </button>
      </div>
    </div>
  );
}