import { NextResponse } from 'next/server';

async function getGoogleDriveUrl(id: string): Promise<string | null> {
    const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
    if (!accessToken) {
        console.error("Google Drive access token is not set for streaming.");
        return null;
    }

    // For private files, we can't use a simple media link with an API key.
    // We must use a method that works with authentication. The webContentLink
    // is a link that, when visited, redirects to a temporary, streamable URL.
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=webContentLink`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store' // The resulting URL is temporary, so we shouldn't cache this request.
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to fetch Google Drive file metadata for streaming:", errorText);
        return null;
    }

    const data = await res.json();
    return data.webContentLink || null;
}


async function getOneDriveUrl(id: string): Promise<string | null> {
    const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
    if (!accessToken) {
        console.error("OneDrive access token is not set.");
        return null;
    }
    // OneDrive provides a pre-authenticated, short-lived download URL directly.
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}?$select=id,@microsoft.graph.downloadUrl`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        next: {
            revalidate: 0 // Always fetch a fresh URL
        }
    });

    if (!res.ok) {
        console.error("Failed to fetch OneDrive item", await res.text());
        return null;
    }

    const data = await res.json();
    return data['@microsoft.graph.downloadUrl'] || null;
}


export async function GET(request: Request, { params }: { params: { videoId: string } }) {
  const { videoId } = params;
  const [source, id] = videoId.split(/-(.*)/s);

  if (!source || !id) {
    return NextResponse.json({ error: 'Invalid video ID format. Expected "gdrive-ID" or "onedrive-ID".' }, { status: 400 });
  }

  try {
    let url: string | null = null;
    if (source === 'gdrive') {
        url = await getGoogleDriveUrl(id);
    } else if (source === 'onedrive') {
        url = await getOneDriveUrl(id);
    } else {
        return NextResponse.json({ error: 'Invalid source specified.' }, { status: 400 });
    }

    if (!url) {
        return NextResponse.json({ error: `Could not retrieve video URL from ${source}. The file may not be accessible or the provider token may have expired.` }, { status: 404 });
    }

    // For Google Drive, the webContentLink redirects. For other providers, it might be direct.
    // Instead of returning JSON, we can redirect the client directly to the streamable URL.
    return NextResponse.redirect(url, { status: 302 });

  } catch (error) {
    console.error(`Error fetching video URL for ${videoId}:`, error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
