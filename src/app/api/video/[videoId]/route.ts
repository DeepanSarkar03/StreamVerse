import { NextResponse } from 'next/server';

async function getGoogleDriveUrl(id: string): Promise<string | null> {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) {
        console.error("Google Drive API key is not set.");
        return null;
    }
    // GDrive URLs are static and can be constructed directly.
    return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${apiKey}`;
}

async function getOneDriveUrl(id: string): Promise<string | null> {
    const accessToken = process.env.ONEDRIVE_ACCESS_TOKEN;
    if (!accessToken) {
        console.error("OneDrive access token is not set.");
        return null;
    }
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
        return NextResponse.json({ error: 'Could not retrieve video URL.' }, { status: 404 });
    }

    return NextResponse.json({ url });

  } catch (error) {
    console.error(`Error fetching video URL for ${videoId}:`, error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
