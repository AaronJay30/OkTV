# OKtv - Your Online Karaoke Party Room 🎤🎶

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/) [![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**OKtv** is a real-time, interactive karaoke application that lets you and your friends create virtual rooms, queue up your favorite YouTube tracks, and sing your hearts out together!

## ✨ Features (Version 1.0)

OKtv is packed with features to make your online karaoke sessions seamless and fun:

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
    Create a `.env.local` file in the root directory of the project. You'll need to add your Firebase project configuration and a YouTube Data API v3 key.

    Example `.env.local`:

    ```env
    # Firebase Configuration (replace with your actual Firebase project config)
    NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_firebase_project_id"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
    NEXT_PUBLIC_FIREBASE_APP_ID="your_firebase_app_id"

    # YouTube Data API v3 Key
    NEXT_PUBLIC_YOUTUBE_API_KEY="your_youtube_api_key"
    ```

    -   Get your Firebase configuration from your Firebase project settings.
    -   Get your YouTube API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Make sure the YouTube Data API v3 is enabled for your project.

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

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/oktv/issues).

## 📝 License

This project is [MIT](LICENSE) licensed.

---

Enjoy your karaoke party with OKtv! 🎉
