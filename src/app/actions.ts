'use server';

import { revalidatePath } from 'next/cache';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';

export async function uploadVideo(prevState: any, formData: FormData) {
  const file = formData.get('file') as File | null;
  const destination = formData.get('destination') as 'azure' | null;

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }
  if (!destination || destination !== 'azure') {
    return { error: 'Invalid destination.' };
  }

  // We'll keep a reasonable limit to prevent accidental large uploads.
  // This is a safeguard, but the streaming approach can handle much larger files.
  if (file.size > 5 * 1024 * 1024 * 1024) { // 5 GB limit
    return { error: 'File is too large. Please upload files under 5GB.' };
  }

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

    if (!connectionString || !containerName) {
      return { error: 'Azure Storage environment variables are not set on the server.' };
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure the container exists. For this app, we assume it's publicly accessible for blobs.
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = file.name; // Use the original file name as the blob name
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // This is the critical fix: Use streams to avoid loading the entire file into memory.
    // Convert the web stream from the File object to a Node.js stream that the Azure SDK expects.
    const nodeStream = Readable.fromWeb(file.stream() as any);

    await blockBlobClient.uploadStream(nodeStream, undefined, undefined, {
        blobHTTPHeaders: { blobContentType: file.type }
    });

    revalidatePath('/');
    return { success: `Successfully uploaded "${file.name}" to Azure Blob Storage.` };

  } catch (e) {
    let errorMessage = 'An unknown error occurred during upload.';
    if (e instanceof Error) {
        errorMessage = `An unexpected server error occurred: ${e.message}`;
    }
    console.error(errorMessage, e); // Log the full error on the server
    return { error: errorMessage };
  }
}
