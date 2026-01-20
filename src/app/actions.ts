// @ts-nocheck
'use server';

import { revalidatePath } from 'next/cache';

export async function uploadVideo(prevState: any, formData: FormData) {
  const file = formData.get('file') as File | null;
  const destination = formData.get('destination') as 'onedrive' | null;

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }
  if (!destination || destination !== 'onedrive') {
    return { error: 'Invalid destination.' };
  }

  try {
    const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
    const folderId = process.env.ONEDRIVE_FOLDER_ID;
    if (!accessToken || !folderId) {
      return { error: 'OneDrive environment variables are not set on the server.' };
    }

    const fileBuffer = await file.arrayBuffer();

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encodeURIComponent(file.name)}:/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
      },
      body: fileBuffer,
    });

    if (!res.ok) {
        const errorText = await res.text();
        // Try to parse the error as JSON, but fall back to text.
        let errorMessage = `Status ${res.status}: ${errorText}`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.message) {
                errorMessage = errorJson.error.message;
            }
        } catch (e) {
            // Not a JSON error, use the raw text.
        }
        return { error: `OneDrive upload failed: ${errorMessage}` };
    }

    revalidatePath('/');
    return { success: `Successfully uploaded "${file.name}" to OneDrive.` };
  } catch (e) {
    if (e instanceof Error) {
        return { error: `An unexpected server error occurred: ${e.message}` };
    }
    return { error: 'An unknown error occurred during upload.' };
  }
}
