// @ts-nocheck
'use server';

import { revalidatePath } from 'next/cache';

async function uploadToOneDrive(file: File) {
  const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;
  if (!accessToken || !folderId) {
    throw new Error('OneDrive environment variables are not set.');
  }

  // Convert file to ArrayBuffer to send to OneDrive API
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
    console.error('OneDrive upload failed response:', errorText);
    try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`OneDrive upload failed: ${errorJson.error.message}`);
    } catch (e) {
        throw new Error(`OneDrive upload failed with non-JSON response: ${errorText}`);
    }
  }

  return res.json();
}


export async function uploadVideo(prevState: any, formData: FormData) {
  const file = formData.get('file') as File | null;
  const destination = formData.get('destination') as 'onedrive' | null;

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }
  if (!destination) {
    return { error: 'Please select an upload destination.' };
  }

  try {
    if (destination === 'onedrive') {
      await uploadToOneDrive(file);
    } else {
      return { error: 'Invalid destination.' };
    }

    revalidatePath('/');
    return { success: `Successfully uploaded "${file.name}" to OneDrive.` };
  } catch (e) {
    if (e instanceof Error) {
        return { error: e.message };
    }
    return { error: 'An unknown error occurred during upload.' };
  }
}
