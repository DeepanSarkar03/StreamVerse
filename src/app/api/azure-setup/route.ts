import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// Check and configure Azure container for optimal streaming
export async function GET() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return NextResponse.json({ 
      error: 'Azure Storage not configured',
      configured: false 
    }, { status: 500 });
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container exists
    const exists = await containerClient.exists();
    
    if (!exists) {
      return NextResponse.json({
        error: 'Container does not exist',
        configured: false,
        containerName,
        suggestion: 'Upload a video to create the container automatically'
      });
    }

    // Get container properties
    const properties = await containerClient.getProperties();
    const accessType = properties.blobPublicAccess;
    
    // Check if public access is properly configured
    const isPubliclyAccessible = accessType === 'blob' || accessType === 'container';
    
    return NextResponse.json({
      configured: true,
      containerName,
      publicAccess: accessType,
      isPubliclyAccessible,
      streamingOptimal: isPubliclyAccessible,
      recommendation: isPubliclyAccessible 
        ? 'Container is optimally configured for direct streaming'
        : 'Container should have public blob access for best streaming performance',
      directStreamingAvailable: isPubliclyAccessible
    });

  } catch (error) {
    console.error('Azure setup check failed:', error);
    return NextResponse.json({
      error: 'Failed to check Azure configuration',
      configured: false,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Configure container for optimal streaming
export async function POST() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return NextResponse.json({ 
      error: 'Azure Storage not configured' 
    }, { status: 500 });
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Create container with public blob access if it doesn't exist
    await containerClient.createIfNotExists({ 
      access: 'blob' // Allow public read access to blobs for direct streaming
    });

    // If container already exists, update access level
    try {
      await containerClient.setAccessPolicy('blob');
    } catch (error) {
      console.log('Access policy may already be set correctly');
    }

    return NextResponse.json({
      success: true,
      message: 'Container configured for optimal streaming',
      containerName,
      publicAccess: 'blob',
      directStreamingEnabled: true
    });

  } catch (error) {
    console.error('Failed to configure Azure container:', error);
    return NextResponse.json({
      error: 'Failed to configure container',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}