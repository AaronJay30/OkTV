# OKtv - Karaoke Room Application

A real-time karaoke room application built with Next.js, where users can join rooms, search for songs, and sing together.

## Features

-   Create and join karaoke rooms
-   Search for songs using YouTube API
-   Real-time queue management
-   Room sharing via QR code
-   Responsive design for mobile and desktop

## Getting Started

### Prerequisites

-   Node.js (v16 or later)
-   npm or pnpm

### Installation

1. Clone the repository
2. Install dependencies:
    ```bash
    npm install
    # or
    pnpm install
    ```
3. Create a `.env.local` file in the root directory based on `.env.example`:

    ```
    YOUTUBE_API_KEY=your_youtube_api_key
    ```

    Get your YouTube API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

4. Start the development server:

    ```bash
    npm run dev
    # or
    pnpm dev
    ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## Environment Variables

-   `YOUTUBE_API_KEY`: Your YouTube Data API v3 key (required for song search functionality)

## License

[MIT](LICENSE)
