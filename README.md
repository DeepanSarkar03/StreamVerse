# StreamVerse

StreamVerse is a super-simple, Netflix-like streaming web app that allows you to stream videos from your personal Azure Blob Storage container.

## Core Features

- **Unified Library**: Automatically lists video files from your specified Azure Blob Storage container.
- **Direct Streaming**: Stream videos directly in the browser with a clean, native player interface.
- **Easy Uploads**: Upload new videos directly to your Azure Blob Storage container from within the app.
- **Instant Search**: Quickly find videos with client-side search.
- **Netflix-inspired UI**: A modern, dark-themed interface for a cinematic browsing experience.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Components, Server Actions)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Storage**: [Azure Blob Storage](https://azure.microsoft.com/en-us/products/storage/blobs)
- **Deployment**: Ready for Vercel, Netlify, or self-hosting.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd streamverse
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the project and add the following variables:
    
    ```
    # Your full Azure Storage connection string.
    # Find this in the Azure Portal under your Storage Account > Access keys.
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"

    # The name of the blob container where your videos are stored.
    AZURE_STORAGE_CONTAINER_NAME="videos"
    ```
    
    **Important**: For video streaming to work, your container's public access level must be set to "Blob (anonymous read access for blobs only)". The upload action will attempt to create the container with this setting if it doesn't exist.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:9002](http://localhost:9002) in your browser to see the result.

## Backend API

The backend is implemented using Next.js Route Handlers and Server Actions.

-   `GET /api/videos`: Fetches and returns a list of video files from Azure Blob Storage.
-   `GET /api/video/[blobName]`: Returns a public, streamable URL for a specific video.
-   **Server Action (`uploadVideo`)**: Handles multipart form data for uploading files to Azure Blob Storage, ensuring the connection string is not exposed on the client.
