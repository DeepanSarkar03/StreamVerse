// @ts-nocheck
'use server';

import { revalidatePath } from 'next/cache';

async function uploadToGoogleDrive(file: File) {
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!accessToken || !folderId) {
    throw new Error('Google Drive environment variables are not set.');
  }

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Google Drive upload failed:', error);
    throw new Error(`Google Drive upload failed: ${error.error.message}`);
  }

  return res.json();
}


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
  const destination = formData.get('destination') as 'gdrive' | 'onedrive' | null;

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }
  if (!destination) {
    return { error: 'Please select an upload destination.' };
  }

  try {
    if (destination === 'gdrive') {
      await uploadToGoogleDrive(file);
    } else if (destination === 'onedrive') {
      await uploadToOneDrive(file);
    } else {
      return { error: 'Invalid destination.' };
    }

    revalidatePath('/');
    return { success: `Successfully uploaded "${file.name}" to ${destination === 'gdrive' ? 'Google Drive' : 'OneDrive'}.` };
  } catch (e) {
    if (e instanceof Error) {
        return { error: e.message };
    }
    return { error: 'An unknown error occurred during upload.' };
  }
}