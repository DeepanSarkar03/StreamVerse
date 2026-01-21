import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

// Generate captions for a video using AI transcription
export async function POST(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid video ID.' }, { status: 400 });
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  const geminiApiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_URL;

  if (!connectionString || !containerName) {
    return NextResponse.json({ error: 'Azure Storage not configured.' }, { status: 500 });
  }

  if (!geminiApiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured. Add GOOGLE_GENAI_API_KEY to .env.local' }, { status: 500 });
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if video exists
    const videoBlobClient = containerClient.getBlockBlobClient(videoId);
    const videoExists = await videoBlobClient.exists();
    
    if (!videoExists) {
      return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
    }

    // Check if captions already exist
    const captionFileName = videoId.replace(/\.(mp4|mkv|mov|avi|webm)$/i, '.vtt');
    const captionBlobClient = containerClient.getBlockBlobClient(captionFileName);
    const captionExists = await captionBlobClient.exists();
    
    if (captionExists) {
      return NextResponse.json({ 
        success: true, 
        message: 'Captions already exist for this video.',
        captionFile: captionFileName
      });
    }

    // Get video properties for size check
    const properties = await videoBlobClient.getProperties();
    const videoSizeMB = (properties.contentLength || 0) / (1024 * 1024);
    
    // Gemini has limits on file size for direct upload
    // For large videos, we'd need a different approach (extract audio, chunk it, etc.)
    if (videoSizeMB > 100) {
      return NextResponse.json({ 
        error: 'Video is too large for direct transcription. Maximum size is 100MB.',
        suggestion: 'For larger videos, consider using Azure Speech Services or extracting audio first.'
      }, { status: 400 });
    }

    // Download video to buffer for Gemini
    const downloadResponse = await videoBlobClient.download(0);
    if (!downloadResponse.readableStreamBody) {
      return NextResponse.json({ error: 'Failed to download video.' }, { status: 500 });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const videoBuffer = Buffer.concat(chunks);
    const base64Video = videoBuffer.toString('base64');

    // Call Gemini API for transcription
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: properties.contentType || 'video/mp4',
                  data: base64Video
                }
              },
              {
                text: `Transcribe all spoken words in this video. Output ONLY a valid WebVTT file format. 
Start with "WEBVTT" on the first line, then blank line, then cues.
Each cue should have:
- A cue number
- Timestamp in format: HH:MM:SS.mmm --> HH:MM:SS.mmm
- The spoken text

Example format:
WEBVTT

1
00:00:00.000 --> 00:00:03.000
Hello, welcome to the video.

2
00:00:03.500 --> 00:00:06.000
Today we're going to discuss...

If there is no speech in the video, output:
WEBVTT

1
00:00:00.000 --> 00:00:05.000
[No speech detected in this video]

Be accurate with timestamps. Only output the VTT content, nothing else.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to transcribe video with AI.',
        details: errorText
      }, { status: 500 });
    }

    const geminiResult = await geminiResponse.json();
    let vttContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up the response - remove markdown code blocks if present
    vttContent = vttContent.replace(/```vtt\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Ensure it starts with WEBVTT
    if (!vttContent.startsWith('WEBVTT')) {
      vttContent = 'WEBVTT\n\n' + vttContent;
    }

    // Upload the VTT file to Azure
    await captionBlobClient.upload(vttContent, vttContent.length, {
      blobHTTPHeaders: { blobContentType: 'text/vtt' }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Captions generated successfully!',
      captionFile: captionFileName
    });

  } catch (error) {
    console.error('Error generating captions:', error);
    return NextResponse.json({ 
      error: 'Failed to generate captions.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
