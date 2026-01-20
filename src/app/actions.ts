// @ts-nocheck
'use server';

import { revalidatePath } from 'next/cache';

async function uploadToOneDrive(file: File) {
  const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
  const folderId = process.env.ONEDRIVE_FOLDER_ID;
  if (!accessToken || !folderId) {
    throw new Error('OneDrive environment variables are not set.');
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encodeURIComponent(file.name)}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('OneDrive upload failed:', error);
    throw new Error(`OneDrive upload failed: ${error.error.message}`);
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
