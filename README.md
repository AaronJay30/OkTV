# OKtv - Your Online Karaoke Party Room 🎤🎶

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/) [![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**OKtv** is a real-time, interactive karaoke application that lets you and your friends create virtual rooms, queue up your favorite YouTube tracks, and sing your hearts out together!

## 🚀 Version 3.0: Performance Scoring System

We're excited to announce our brand new karaoke scoring feature that turns your performances into friendly competitions:

-   🏆 **Automatic Performance Scoring** - When a song ends, see your score with fun animations and sound effects
-   📊 **High Score Leaderboard** - Track the best performances with color-coded rankings (gold, silver, bronze)
-   🎵 **Interactive Experience** - Beautiful score reveal animations with star effects and performance ratings
-   🔊 **Sound Effects** - Immersive audio feedback enhances the scoring experience
-   🎮 **Room Creator Controls** - Enable or disable scoring when creating your karaoke room

This feature works seamlessly with our existing microphone integration, creating the most interactive online karaoke experience available!

## 🚀 Version 2.0: Phone as Microphone Feature

OKtv now includes a powerful microphone integration that turns any device into a personal microphone:

-   **Room Creator Controls:** Enable or disable the microphone feature when creating a room
-   **WebRTC Integration:** Real-time, low-latency audio streaming between participants and admin
-   **Admin Controls:**
    -   See which users have their microphone on with visual indicators (green for active, red for muted)
    -   Mute any participant's microphone (user cannot re-enable until unmuted by admin)
    -   Adjust individual microphone volumes with intuitive sliders
-   **User Experience:**
    -   Simple, large microphone button in the dedicated Mic tab
    -   Clear status indicators showing when muted by admin
    -   Permission handling for browser microphone access
-   **Video Player Improvements:**
    -   Volume slider for video playback (replaces basic mute button)
    -   More responsive controls with visual feedback

### 🎤 Microphone & Audio

-   **Live Microphone Support:** Users can turn on their microphone to sing along with the music.
-   **Host Audio Control:** Room hosts can manage participant microphones.
-   **Low-Latency Audio Optimization:** Advanced audio processing to minimize delay between microphone input and audio output, providing better synchronization with music.
    -   Optimized audio constraints for minimal processing delay
    -   WebRTC configuration for prioritizing real-time audio
    -   Web Audio API integration for minimal buffer sizes and direct audio routing
    -   Prioritized audio packet delivery for consistent streaming

### 💡 Technical Features

-   **WebRTC Signaling:** Firebase Realtime Database for WebRTC connection setup
-   **Audio Processing:** Real-time audio stream management with volume control
-   **Permissions Management:** Graceful handling of browser microphone permissions
-   **State Synchronization:** Real-time mic status updates across all users

## ✨ Version 1.0: Core Features

### 🏠 Room Management

-   **Create & Join Rooms:** Easily start a new karaoke room or join an existing one using a simple room code.
-   **Admin Privileges:** The user who creates a room is designated as the "HOST" with special controls.
-   **Secure Room Access:**
    -   Room IDs have a fixed length for validity.
    -   Users cannot join non-existent rooms (non-admins are redirected).
    -   Admins can create a room if the ID is valid but the room doesn't exist.
-   **Easy Sharing:**
    -   Share rooms via a direct join link or a simple room ID.
    -   Copy-to-clipboard buttons for both the full link and room ID.
    -   QR code generation for quick mobile joining.

### 🧑‍🤝‍🧑 User Experience

-   **Unique User Identity:** Prevents duplicate usernames within a room.
-   **Session Persistence:** Stay logged into your room even after a page reload or if you rejoin.
-   **"HOST" Indicator:** Admins are clearly marked with a "HOST" tag in the navigation bar.
-   **Clean Favicon:** Custom application icon for your browser tab.

### 🎶 Music & Playback

-   **YouTube Integration:** Search and add any song from YouTube to the room's queue.
-   **Auto-Play First Song:** The first song added to an empty room automatically starts playing for everyone.
-   **Continuous Play:** The next song in the queue plays automatically after the current one finishes.
-   **Differentiated Player Views:**
    -   **Admin View:** Full embedded YouTube player with all standard controls, plus dedicated app controls.
    -   **Participant View:** A sleek display showing the current song's thumbnail, title, and who added it – no distracting player controls.
-   **Admin Playback Controls:**
    -   Admins have exclusive control over `Play`, `Pause`, `Skip`, and `Mute/Unmute` functions for the room's music.
    -   Ability to toggle the visibility of these player controls for a cleaner interface.
-   **Distraction-Free Player:** YouTube's default overlay UI (like video titles, watch later buttons) is hidden for a more immersive karaoke experience.

### 🎨 Interface & Design

-   **Responsive Design:** Enjoy OKtv on both desktop and mobile devices.
-   **Intuitive Sidebar:**
    -   Manage the song queue.
    -   View users in the room (Users tab visible only to admins).
-   **Modern Look & Feel:** Built with Tailwind CSS and Shadcn/UI for a polished experience.

## 🚀 Version 1.1: Docker Support

### 🐳 Docker Support

-   **Development Environment:** Easily run the application in a Docker container for consistent development environments
-   **Docker Compose Integration:** Start the application with all dependencies using a single command
-   **Hot Reloading:** Changes made to code are reflected in real-time thanks to volume mounting
-   **Environment Consistency:** Ensures the same Node.js version and dependencies for all developers

### 📄 Docker Setup

OKtv now includes Docker configuration for development:

```bash
# Build and start the application using Docker Compose
docker-compose up --build

# Run the application in the background
docker-compose up -d

# Stop the application
docker-compose down
```

All Docker commands are also available as npm scripts:

```bash
# Start the development environment
pnpm docker:dev

# Build the Docker image
pnpm docker:build

# Start the Docker container
pnpm docker:start

# Start the Docker container in detached mode
pnpm docker:start:detached
```

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18 or later recommended)
-   pnpm (or npm/yarn)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/oktv.git
    cd oktv
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    # or
    # npm install
    # or
    # yarn install
    ```
3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root directory of the project. You'll need to add your Firebase project configuration and one or more YouTube Data API v3 keys.

    Example `.env.local`:

    ```env
    # Firebase Configuration (replace with your actual Firebase project config)
    NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_firebase_project_id"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
    NEXT_PUBLIC_FIREBASE_APP_ID="your_firebase_app_id"

    # YouTube Data API v3 Keys (server-only — do NOT prefix with NEXT_PUBLIC_)
    # The /api/youtube/search route rotates through this pool automatically.
    # Add as many keys as you have, ideally distributed across multiple GCP
    # projects so each project has its own daily quota.
    YOUTUBE_API_KEY_1="your_youtube_api_key_1"
    YOUTUBE_API_KEY_2="your_youtube_api_key_2"
    YOUTUBE_API_KEY_3="your_youtube_api_key_3"

    # Legacy single-key form is also accepted:
    # YOUTUBE_API_KEY="your_youtube_api_key"

    # Auto-rotate through the pool when a key hits a quota-class error
    # (rateLimitExceeded, quotaExceeded, etc.). When false, the route uses only
    # YOUTUBE_API_KEY and surfaces the first quota error as 429 immediately.
    # Accepted: true | false (default: true)
    YOUTUBE_API_KEY_AUTO_ROTATE="true"

    # Maximum number of YOUTUBE_API_KEY_N slots the route will scan (1-100,
    # default 20). Set this to however many keys you actually have so the route
    # reads every configured key without you touching the code. Example: 8 today,
    # 12 next week — just bump this number.
    YOUTUBE_API_KEY_MAX_SLOTS="20"
    ```

    -   Get your Firebase configuration from your Firebase project settings.
    -   Get your YouTube API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Make sure the YouTube Data API v3 is enabled for your project.
    -   **Important:** keys must live in **different GCP projects** to benefit from rotation. Multiple keys in the same project share one per-project daily quota and will all hit `rateLimitExceeded` at the same time. See [`specs/01-rotational-api-key.md`](specs/01-rotational-api-key.md) for details.
    -   **`YOUTUBE_API_KEY_AUTO_ROTATE`** — set to `false` if you want fail-fast behavior (only `YOUTUBE_API_KEY` is used; the first quota error returns `429` without trying the other keys). Default is `true`.
    -   **`YOUTUBE_API_KEY_MAX_SLOTS`** — how many `YOUTUBE_API_KEY_N` slots the route scans. Use 8 today, 12 next week, whatever you need. Range `1`-`100`, default `20`.

4.  **Start the development server:**
    ```bash
    pnpm dev
    # or
    # npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 🛠️ Built With

-   **Framework:** [Next.js](https://nextjs.org/) (React)
-   **Backend & Realtime Database:** [Firebase](https://firebase.google.com/) (Firestore, Realtime Database features)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components:** [Shadcn/UI](https://ui.shadcn.com/)
-   **Video Player:** [react-youtube](https://github.com/tjallingt/react-youtube)
-   **Icons:** [Lucide React](https://lucide.dev/)
-   **Animations:** [Framer Motion](https://www.framer.com/motion/)
-   **Audio Effects:** Web Audio API
-   **Data Visualization:** Custom scoring animations and leaderboard displays

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/oktv/issues).

## 📝 License

This project is [MIT](LICENSE) licensed.

---

Enjoy your karaoke party with OKtv! 🎉
