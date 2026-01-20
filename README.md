# StreamVerse

StreamVerse is a super-simple, Netflix-like streaming web app that allows you to stream videos from your personal Google Drive and OneDrive folders.

## Core Features

- **Unified Library**: Automatically lists and merges video files from specified Google Drive and OneDrive folders.
- **Direct Streaming**: Stream videos directly in the browser with a clean, native player interface.
- **Easy Uploads**: Upload new videos directly to your Google Drive or OneDrive from within the app.
- **Instant Search**: Quickly find videos with client-side search.
- **Netflix-inspired UI**: A modern, dark-themed interface for a cinematic browsing experience.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Components, Server Actions)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
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
    Create a file named `.env.local` in the root of the project by copying the example file:
    ```bash
    cp .env.local.example .env.local
    ```
    Fill in the required values in `.env.local`. See the comments in the file for guidance on where to get each key and ID.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:9002](http://localhost:9002) in your browser to see the result.

## Backend API

The backend is implemented using Next.js Route Handlers and Server Actions.

-   `GET /api/videos`: Fetches, merges, and returns a list of video files from both Google Drive and OneDrive.
-   `GET /api/video/[videoId]`: Returns a fresh, streamable URL for a specific video, used by the player page.
-   **Server Action (`uploadVideo`)**: Handles multipart form data for uploading files to the selected cloud storage provider, ensuring API keys are not exposed on the client.
