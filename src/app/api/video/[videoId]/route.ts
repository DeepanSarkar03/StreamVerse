import { NextResponse } from 'next/server';

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

  if (!source || !id || source !== 'onedrive') {
    return NextResponse.json({ error: 'Invalid video ID format. Expected "onedrive-ID".' }, { status: 400 });
  }

  try {
    const url = await getOneDriveUrl(id);

    if (!url) {
        return NextResponse.json({ error: `Could not retrieve video URL from onedrive. The file may not be accessible or the provider token may have expired.` }, { status: 404 });
    }

    // Instead of returning JSON, we can redirect the client directly to the streamable URL.
    return NextResponse.redirect(url, { status: 302 });

  } catch (error) {
    console.error(`Error fetching video URL for ${videoId}:`, error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
