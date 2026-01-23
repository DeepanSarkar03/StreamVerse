import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'movies';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const filename = formData.get('filename') as string;

    if (!file && !url) {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 });
    }

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const originalPath = path.join(tempDir, `original_${timestamp}.tmp`);
    const convertedPath = path.join(tempDir, `converted_${timestamp}.mp4`);

    try {
      // Step 1: Download/Save the file
      console.log('📥 Step 1: Downloading file...');
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(originalPath, buffer);
      } else if (url) {
        // Handle Google Drive URLs
        let downloadUrl = url;
        
        // Convert Google Drive share link to direct download
        if (url.includes('drive.google.com')) {
          const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (fileIdMatch) {
            const fileId = fileIdMatch[1];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            console.log('Converted Google Drive URL:', downloadUrl);
          }
        }
        
        // Download from URL
        console.log('Downloading from:', downloadUrl);
        const response = await fetch(downloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(originalPath, buffer);
        console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      }

      // Step 2: Check if conversion is needed
      console.log('🔍 Step 2: Analyzing video codec...');
      let needsConversion = false;
      try {
        const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,pix_fmt -of default=noprint_wrappers=1 "${originalPath}"`);
        console.log('Video info:', stdout);
        
        // Check if it's already H.264 with baseline profile
        if (!stdout.includes('codec_name=h264') || 
            !stdout.includes('yuv420p') || 
            stdout.includes('High') || 
            stdout.includes('Main')) {
          needsConversion = true;
          console.log('⚠️ Video needs conversion for browser compatibility');
        } else {
          console.log('✅ Video is already browser-compatible');
        }
      } catch (error) {
        // If ffprobe fails, assume conversion is needed
        needsConversion = true;
        console.log('⚠️ Could not analyze video, will convert to be safe');
      }

      let finalPath = originalPath;

      // Step 3: Convert if needed
      if (needsConversion) {
        console.log('🔄 Step 3: Converting to browser-compatible format...');
        console.log('This may take a few minutes for large files...');
        
        const convertCommand = `ffmpeg -i "${originalPath}" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -y "${convertedPath}"`;
        
        await execAsync(convertCommand, { maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer
        
        console.log('✅ Conversion complete!');
        finalPath = convertedPath;
      } else {
        console.log('⏭️ Step 3: Skipping conversion (not needed)');
      }

      // Step 4: Upload to Azure
      console.log('☁️ Step 4: Uploading to Azure...');
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      
      const finalFilename = filename || `video_${timestamp}.mp4`;
      const blockBlobClient = containerClient.getBlockBlobClient(finalFilename);
      
      await blockBlobClient.uploadFile(finalPath, {
        blobHTTPHeaders: {
          blobContentType: 'video/mp4',
        },
      });

      console.log('✅ Upload complete!');

      // Step 5: Cleanup temp files
      console.log('🧹 Step 5: Cleaning up...');
      try {
        await unlink(originalPath);
        if (needsConversion && existsSync(convertedPath)) {
          await unlink(convertedPath);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }

      return NextResponse.json({
        success: true,
        filename: finalFilename,
        converted: needsConversion,
        message: needsConversion 
          ? 'Video converted and uploaded successfully!' 
          : 'Video uploaded successfully (no conversion needed)!',
        watchUrl: `/watch/${encodeURIComponent(finalFilename)}`
      });

    } catch (error) {
      // Cleanup on error
      try {
        if (existsSync(originalPath)) await unlink(originalPath);
        if (existsSync(convertedPath)) await unlink(convertedPath);
      } catch {}
      
      throw error;
    }

  } catch (error) {
    console.error('Smart upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}