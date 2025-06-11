"use client";

import type React from "react";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import "../styles.css";
import {
    Music,
    Search,
    Plus,
    Trash2,
    SkipForward,
    Play,
    Pause,
    Share2,
    QrCode,
    ArrowLeft,
    Volume2,
    VolumeX,
    Loader2,
    Maximize2,
    Minimize2,
    PanelRightClose,
    PanelRightOpen,
    Users,
    Eye, // Added
    EyeOff, // Added
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { searchYouTube } from "@/lib/youtube";
import type { ComponentType } from "react";
import {
    createRoom,
    checkRoomExists,
    addSongToQueue,
    // removeSongFromQueue, // Will use safelyRemoveSong from the combined hook
    addUserToRoom,
    removeUserFromRoom,
    updateCurrentSong,
    updatePlayerState,
    findUserByNameInRoom, // Import the new function
} from "@/lib/firebase-service";
import {
    // useFirebaseQueue, // Removed
    // useFirebaseCurrentSong, // Removed
    // useFirebasePlayerState, // Removed
    useFirebaseUsers,
    useFirebaseRoom,
    useQueueAndCurrentSong,
} from "@/lib/firebase-hooks";

// Define YouTube component props type
interface YouTubeProps {
    videoId: string;
    id?: string;
    className?: string;
    opts?: {
        height?: string | number;
        width?: string | number;
        playerVars?: {
            autoplay?: number;
            controls?: number;
            disablekb?: number;
            [key: string]: any;
        };
        [key: string]: any;
    };
    onReady?: (event: any) => void;
    onPlay?: (event: any) => void;
    onPause?: (event: any) => void;
    onEnd?: (event: any) => void;
    onError?: (event: any) => void;
    onStateChange?: (event: any) => void;
    onPlaybackRateChange?: (event: any) => void;
    onPlaybackQualityChange?: (event: any) => void;
}

// Dynamically import YouTube component with SSR disabled and proper typing
const YouTube = dynamic<YouTubeProps>(
    () =>
        import("react-youtube").then(
            (mod) => mod.default as ComponentType<YouTubeProps>
        ),
    { ssr: false }
);

// Types
interface Song {
    id: string;
    title: string;
    thumbnail: string;
    addedBy: string;
    firebaseKey?: string;
    addedAt?: string;
}

interface User {
    id: string;
    name: string;
    isAdmin: boolean;
}

type RoomValidationStatus =
    | "idle"
    | "validating_length"
    | "checking_existence"
    | "valid"
    | "invalid_redirecting";

export default function Room() {
    const params = useParams();
    const router = useRouter();
    const searchParamsHook = useSearchParams();
    const roomId = params.id as string;

    const ROOM_ID_LENGTH = 6;

    const [roomValidationStatus, setRoomValidationStatus] =
        useState<RoomValidationStatus>("idle");
    const [showNamePrompt, setShowNamePrompt] = useState(false); // Initialize to false

    const isAdmin = searchParamsHook.get("admin") === "true";
    const [userName, setUserName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    // showNamePrompt is now initialized to false, its logic is handled in initializeRoom
    const [activeTab, setActiveTab] = useState("search");
    const [showSidebar, setShowSidebar] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [origin, setOrigin] = useState("");
    const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Firebase hooks (unconditional)
    const [users, usersLoading, usersError] = useFirebaseUsers(roomId);
    const [roomData, roomLoading, roomError] = useFirebaseRoom(roomId);
    const [
        {
            queue: queueCombined,
            currentSong: currentSongCombined,
            isPlaying: isPlayingCombined,
            isMuted: isMutedCombined,
        },
        combinedLoading,
        combinedError,
        queueActions,
    ] = useQueueAndCurrentSong(roomId, isAdmin);

    // Refs (unconditional)
    const playerRef = useRef<any>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);

    // Navigation functions
    const handleBackToHome = () => {
        router.push("/");
    };

    // Handle name submission for non-admin users
    const handleNameSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (userName.trim() && !isAdmin) {
            const trimmedUserName = userName.trim();
            try {
                // Check if user already exists
                const existingUser = await findUserByNameInRoom(
                    roomId,
                    trimmedUserName
                );
                if (existingUser) {
                    setFirebaseUserId(existingUser.id);
                    if (typeof window !== "undefined") {
                        sessionStorage.setItem("userName", trimmedUserName);
                        sessionStorage.setItem(
                            `firebaseUserId_${roomId}`,
                            existingUser.id
                        );
                    }
                    setShowNamePrompt(false); // Hide prompt after successful re-join/identification
                    toast({
                        title: "Welcome back!",
                        description: `You\'ve rejoined the room as ${trimmedUserName}.`,
                    });
                    return;
                }

                // If user doesn\'t exist, add them
                const user: User = {
                    id: Math.random().toString(36).substring(2, 9), // Placeholder
                    name: trimmedUserName,
                    isAdmin: false,
                };
                const userId = await addUserToRoom(roomId, user);
                setFirebaseUserId(userId);

                if (typeof window !== "undefined") {
                    sessionStorage.setItem("userName", trimmedUserName);
                    sessionStorage.setItem(`firebaseUserId_${roomId}`, userId);
                }
                setShowNamePrompt(false); // Hide prompt after successful addition
            } catch (error) {
                console.error("Error adding user:", error);
                toast({
                    title: "Error",
                    description: "Failed to join room. Please try again.",
                    variant: "destructive",
                });
                // Optionally, keep showNamePrompt true or handle error state
            }
        }
    };

    // Handle copying room code
    const handleCopyRoomCode = () => {
        if (origin) {
            navigator.clipboard.writeText(`${origin}/join?room=${roomId}`);
            toast({
                title: "Join Link Copied!",
                description: "Share it with your friends.",
            });
        } else {
            navigator.clipboard.writeText(roomId); // Fallback if origin is not yet set
            toast({ title: "Room ID Copied!" });
        }
    };

    // Handle copying just the room ID
    const handleCopyJustRoomId = () => {
        navigator.clipboard.writeText(roomId);
        toast({
            title: "Room ID Copied!",
            description: "Just the ID, ready to paste!",
        });
    };

    // Effect for Room ID Length Validation
    useEffect(() => {
        if (roomValidationStatus !== "idle" || !roomId) return;

        setRoomValidationStatus("validating_length");
        if (typeof roomId === "string" && roomId.length === ROOM_ID_LENGTH) {
            setRoomValidationStatus("checking_existence");
        } else {
            setRoomValidationStatus("invalid_redirecting");
            router.push("/room-not-found");
        }
    }, [roomId, router, roomValidationStatus]);

    // Effect for Room Existence Check
    useEffect(() => {
        if (roomValidationStatus !== "checking_existence" || !roomId) return;

        const check = async () => {
            const exists = await checkRoomExists(roomId);
            if (exists) {
                setRoomValidationStatus("valid");
            } else {
                if (isAdmin) {
                    setRoomValidationStatus("valid"); // Admin can create room
                } else {
                    setRoomValidationStatus("invalid_redirecting");
                    router.push("/room-not-found");
                }
            }
        };
        check();
    }, [roomId, router, roomValidationStatus, isAdmin]);

    // Set origin URL on client side, only when room is validated
    useEffect(() => {
        if (roomValidationStatus === "valid") {
            if (typeof window !== "undefined") {
                setOrigin(window.location.origin);
            }
        }
    }, [roomValidationStatus]); // Depends on roomValidationStatus

    // Initialize room and setup Firebase subscriptions
    useEffect(() => {
        if (roomValidationStatus !== "valid" || isInitialized || !roomId) {
            return;
        }

        const initializeRoomLogic = async () => {
            if (isAdmin) {
                setUserName("Room Admin");
                setShowNamePrompt(false); // Ensure prompt is hidden for admin

                const adminUser: User = {
                    id: "admin",
                    name: "Room Admin",
                    isAdmin: true,
                };
                try {
                    const roomExists = await checkRoomExists(roomId);
                    if (!roomExists) {
                        await createRoom(roomId, adminUser);
                    }
                    setFirebaseUserId("admin");
                } catch (error) {
                    console.error("Error initializing admin room:", error);
                    toast({
                        title: "Error",
                        description: "Failed to initialize room.",
                        variant: "destructive",
                    });
                }
            } else {
                // For non-admin users
                const storedName =
                    typeof window !== "undefined"
                        ? sessionStorage.getItem("userName")
                        : null;
                const storedFbId =
                    typeof window !== "undefined"
                        ? sessionStorage.getItem(`firebaseUserId_${roomId}`)
                        : null;

                if (storedName) {
                    setUserName(storedName);
                    setShowNamePrompt(false); // Don't show prompt if we have a name

                    if (storedFbId) {
                        setFirebaseUserId(storedFbId);
                        // Optionally verify user still exists in this room in Firebase
                    } else {
                        const existingUser = await findUserByNameInRoom(
                            roomId,
                            storedName
                        );
                        if (existingUser) {
                            setFirebaseUserId(existingUser.id);
                            if (typeof window !== "undefined") {
                                sessionStorage.setItem(
                                    `firebaseUserId_${roomId}`,
                                    existingUser.id
                                );
                            }
                        } else {
                            const user: User = {
                                id: Math.random().toString(36).substring(2, 9),
                                name: storedName,
                                isAdmin: false,
                            };
                            const userId = await addUserToRoom(roomId, user);
                            setFirebaseUserId(userId);
                            if (typeof window !== "undefined") {
                                sessionStorage.setItem(
                                    `firebaseUserId_${roomId}`,
                                    userId
                                );
                            }
                        }
                    }
                } else {
                    // No storedName found for a non-admin. Prompt for name.
                    setShowNamePrompt(true);
                }
            }
            setIsInitialized(true);
        };

        initializeRoomLogic();

        // Clean up when component unmounts
        return () => {
            if (
                firebaseUserId &&
                firebaseUserId !== "admin" &&
                roomValidationStatus === "valid"
            ) {
                checkRoomExists(roomId)
                    .then((exists) => {
                        if (exists) {
                            removeUserFromRoom(roomId, firebaseUserId).catch(
                                (err) =>
                                    console.error(
                                        "Error removing user on unmount:",
                                        err
                                    )
                            );
                        }
                    })
                    .catch((err) =>
                        console.error(
                            "Error checking room existence on unmount for cleanup:",
                            err
                        )
                    );
            }
        };
    }, [roomId, isAdmin, isInitialized, firebaseUserId, roomValidationStatus]); // Dependencies

    // Handle search
    const handleSearch = async () => {
        if (searchQuery.trim()) {
            try {
                setIsSearching(true);
                const results = await searchYouTube(searchQuery);
                setSearchResults(results || []);
            } catch (error) {
                console.error("Error searching YouTube:", error);
                toast({
                    title: "Search Error",
                    description:
                        "Failed to search for videos. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsSearching(false);
            }
        }
    };

    // Handle adding song to queue
    const handleAddToQueue = async (result: any) => {
        try {
            // Decode HTML entities in the title
            const decodedTitle = result.snippet.title.replace(
                /&(#39|amp|quot|lt|gt);/g,
                (match: string) => {
                    switch (match) {
                        case "&#39;":
                            return "'";
                        case "&amp;":
                            return "&";
                        case "&quot;":
                            return '"';
                        case "&lt;":
                            return "<";
                        case "&gt;":
                            return ">";
                        default:
                            return match;
                    }
                }
            );

            const newSong: Song = {
                id: result.id.videoId,
                title: decodedTitle,
                thumbnail: result.snippet.thumbnails.default.url,
                addedBy: userName,
            };

            // Add to Firebase
            await addSongToQueue(roomId, newSong);

            toast({
                title: "Song Added",
                description: `"${decodedTitle}" added to queue`,
            });

            // If no song is currently playing, play this one
            if (!currentSongCombined && isAdmin) {
                await updateCurrentSong(roomId, newSong);
                await updatePlayerState(roomId, true, false);
            }

            // Switch to queue tab after adding
            setActiveTab("queue");
        } catch (error) {
            console.error("Error adding song to queue:", error);
            toast({
                title: "Error",
                description: "Failed to add song to queue",
                variant: "destructive",
            });
        }
    };

    // Handle removing song from queue
    const handleRemoveFromQueue = async (
        songId: string,
        firebaseKey: string | undefined,
        addedBy: string
    ) => {
        // Only admin can remove any song, users can only remove their own
        if (isAdmin || addedBy === userName) {
            try {
                await queueActions.handleRemoveSpecificSong(
                    songId,
                    firebaseKey
                ); // Use new action
                toast({
                    title: "Song Removed",
                    description: "Song removed from queue",
                });
            } catch (error) {
                console.error("Error removing song from queue:", error);
                toast({
                    title: "Error",
                    description: "Failed to remove song from queue",
                    variant: "destructive",
                });
            }
        }
    };
    // Handle play/pause
    const handlePlayPause = async () => {
        if (playerRef.current && isAdmin) {
            try {
                if (isPlayingCombined) {
                    playerRef.current.pauseVideo();
                } else {
                    playerRef.current.playVideo();
                }

                await updatePlayerState(
                    roomId,
                    !isPlayingCombined,
                    isMutedCombined
                );
            } catch (error) {
                console.error("Error controlling playback:", error);
            }
        }
    };

    // Handle skip
    const handleSkip = async () => {
        try {
            if (isAdmin) {
                // Admin check is now inside the hook, but good to keep here too for UI disabling
                await queueActions.handleSkipSong(); // Use new action
            } else if (queueCombined.length === 0) {
                // Non-admin case, if queue is empty, ensure player stops
                await updatePlayerState(roomId, false, isMutedCombined);
                await updateCurrentSong(roomId, null);
            }
        } catch (error) {
            console.error("Error skipping song:", error);
            toast({
                title: "Error",
                description: "Failed to skip to next song",
                variant: "destructive",
            });
        }
    };

    // Handle mute/unmute
    const handleMute = async () => {
        if (playerRef.current && isAdmin) {
            try {
                if (isMutedCombined) {
                    playerRef.current.unMute();
                } else {
                    playerRef.current.mute();
                }

                await updatePlayerState(
                    roomId,
                    isPlayingCombined,
                    !isMutedCombined
                );
            } catch (error) {
                console.error("Error controlling mute state:", error);
            }
        }
    };

    // Handle player ready
    const onPlayerReady = (event: any) => {
        playerRef.current = event.target;
        // Autoplay if a song is already set and supposed to be playing
        if (currentSongCombined && isPlayingCombined) {
            playerRef.current.playVideo();
        }
        // Set initial mute state
        if (isMutedCombined) {
            playerRef.current.mute();
        } else {
            playerRef.current.unMute();
        }
    };

    // Handle player state change
    const onPlayerStateChange = async (event: any) => {
        // event.data values:
        // -1 (unstarted)
        //  0 (ended)
        //  1 (playing)
        //  2 (paused)
        //  3 (buffering)
        //  5 (video cued)
        if (event.data === 0 && isAdmin) {
            // Song ended
            await queueActions.handleSongEnded(); // Use new action
        } else if (event.data === 1) {
            // Song is playing
            if (!isPlayingCombined && isAdmin) {
                // Use isPlayingCombined
                await updatePlayerState(roomId, true, isMutedCombined); // Use isMutedCombined
            }
        } else if (event.data === 2) {
            // Song is paused
            if (isPlayingCombined && isAdmin) {
                // Use isPlayingCombined
                await updatePlayerState(roomId, false, isMutedCombined); // Use isMutedCombined
            }
        }
    };

    // Failsafe: If queue becomes empty and there\'s a current song, clear it (admin only)
    // This might be redundant if useQueueAndCurrentSong handles it, but good as a failsafe.
    useEffect(() => {
        if (
            isAdmin &&
            isInitialized &&
            queueCombined.length === 0 &&
            currentSongCombined
        ) {
            console.log(
                "Failsafe: Queue is empty, clearing current song from page.tsx"
            );
            updateCurrentSong(roomId, null).catch((err) =>
                console.error("Failsafe current song clear error:", err)
            );
            updatePlayerState(roomId, false, isMutedCombined).catch((err) =>
                console.error("Failsafe player state update error:", err)
            );
        }
    }, [
        isAdmin,
        queueCombined,
        currentSongCombined,
        roomId,
        isInitialized,
        isMutedCombined,
    ]); // Update dependencies

    // Failsafe: If there\'s no current song but player is playing, stop it (admin only)
    useEffect(() => {
        if (
            isAdmin &&
            isInitialized &&
            !currentSongCombined &&
            isPlayingCombined
        ) {
            console.log(
                "Failsafe: No current song, but player is playing. Stopping."
            );
            updatePlayerState(roomId, false, isMutedCombined).catch(
                (
                    err // Use isMutedCombined
                ) => console.error("Failsafe player stop error:", err)
            );
        }
    }, [
        isAdmin,
        currentSongCombined,
        isPlayingCombined,
        roomId,
        isInitialized,
        isMutedCombined,
    ]); // Update dependencies

    // Handle fullscreen toggle
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Toggle sidebar visibility
    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };

    // Toggle player controls visibility
    const toggleControls = () => {
        setShowControls(!showControls);
    };

    // Check if there are persistent Firebase errors across multiple hooks
    const hasFirebaseError =
        [combinedError, usersError, roomError].filter(Boolean).length >= 3;

    // ---- ORDER OF RENDERING CHECKS ----

    // 1. Validation Status Loader
    if (roomValidationStatus !== "valid") {
        let message = "Verifying Room...";
        if (roomValidationStatus === "invalid_redirecting") {
            message = "Redirecting to Room Not Found...";
        } else if (roomValidationStatus === "validating_length") {
            message = "Validating Room ID...";
        } else if (roomValidationStatus === "checking_existence") {
            message = "Checking Room Existence...";
        }

        return (
            <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center">
                <Toaster /> {/* Ensure Toaster is available here */}
                <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg text-center glow-box">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
                    <h2 className="text-xl font-medium mb-2">{message}</h2>
                    <p className="text-gray-400">Please wait a moment.</p>
                </div>
            </div>
        );
    }
    // 2. Name Prompt (if needed, determined by initializeRoomLogic)
    if (showNamePrompt) {
        return (
            <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex flex-col items-center justify-center p-4">
                <Toaster />
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gray-800/70 p-8 rounded-xl shadow-2xl w-full max-w-md glow-box"
                >
                    <h2 className="text-2xl font-bold text-center text-white mb-6">
                        Enter Your Name
                    </h2>
                    <form onSubmit={handleNameSubmit} className="space-y-4">
                        <Input
                            type="text"
                            placeholder="Your Name"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 focus:border-purple-500 text-white"
                            required
                        />
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400"
                            disabled={!userName.trim()}
                        >
                            Join Room
                        </Button>
                    </form>
                </motion.div>
                <Button
                    variant="link"
                    onClick={handleBackToHome}
                    className="mt-8 text-gray-400 hover:text-gray-300"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Button>
            </main>
        );
    }

    // 3. Loading state for Firebase data (after validation and name prompt)
    const isLoadingData =
        (combinedLoading || usersLoading || roomLoading) && isInitialized;

    if (isLoadingData) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center">
                <Toaster />
                <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg text-center glow-box">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
                    <h2 className="text-xl font-medium mb-2">
                        Loading Room Data...
                    </h2>
                    <p className="text-gray-400">Please wait a moment.</p>
                </div>
            </div>
        );
    }

    // 4. Firebase Error UI (after validation, name prompt, and loading checks)
    if (hasFirebaseError && isInitialized) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center">
                <Toaster />
                <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg text-center glow-box">
                    <Music className="h-12 w-12 text-red-500 mx-auto mb-4" />{" "}
                    {/* Changed icon */}
                    <h2 className="text-xl font-medium mb-2 text-red-400">
                        Connection Error
                    </h2>
                    <p className="text-gray-400 mb-4">
                        There was a problem connecting to the room. Please try
                        again later.
                    </p>
                    <Button
                        onClick={handleBackToHome}
                        className="bg-purple-600 hover:bg-purple-500"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <main
            className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white"
            ref={mainContainerRef}
        >
            <Toaster />

            {/* Header - Hidden in fullscreen mode */}
            {!isFullscreen && (
                <header className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            onClick={handleBackToHome}
                            className="mr-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl font-bold glow">
                            Ok<span className="text-purple-500">TV</span>
                        </h1>
                        {isAdmin && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-500/50">
                                HOST
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-purple-500 text-purple-500"
                                >
                                    <QrCode className="h-4 w-4 mr-1" /> Room
                                    Code
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-900 border-gray-700">
                                <DialogHeader>
                                    <DialogTitle className="text-center">
                                        Room ID: {roomId}{" "}
                                        {/* Changed from Room Code to Room ID for clarity */}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col items-center justify-center p-4">
                                    <div className="bg-white p-4 rounded-lg mb-4">
                                        {origin && (
                                            <QRCodeSVG
                                                value={`${origin}/join?room=${roomId}`}
                                                size={200}
                                                level="H"
                                            />
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleCopyRoomCode} // This now copies the full join link
                                        className="bg-purple-600 hover:bg-purple-500 w-full mb-2"
                                    >
                                        <Share2 className="h-4 w-4 mr-2" /> Copy
                                        Join Link
                                    </Button>
                                    <Button
                                        onClick={handleCopyJustRoomId} // New button to copy just the ID
                                        variant="outline"
                                        className="border-purple-500 text-purple-500 hover:bg-purple-500/10 w-full"
                                    >
                                        <QrCode className="h-4 w-4 mr-2" /> Copy
                                        Room ID Only
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </header>
            )}

            <div
                className={cn(
                    "flex flex-col md:flex-row",
                    isFullscreen ? "h-screen" : "h-[calc(100vh-73px)]"
                )}
            >
                {/* Main content - Video Player */}
                <div className="flex-1 p-4 relative">
                    <div className="h-full flex flex-col">
                        {/* Video player container */}
                        <div className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden glow-box">
                            {currentSongCombined ? (
                                isAdmin ? (
                                    // Admin view: Player + Overlay
                                    <div className="relative w-full h-full">
                                        {" "}
                                        {/* Wrapper for YouTube and Overlay */}
                                        <YouTube
                                            videoId={currentSongCombined.id}
                                            opts={{
                                                height: "100%",
                                                width: "100%",
                                                playerVars: {
                                                    autoplay: 1, // Actual play is controlled by isPlayingCombined state
                                                    controls: 0, // Hide native YouTube controls
                                                    disablekb: 1, // Disable keyboard controls
                                                    rel: 0, // Do not show related videos
                                                    modestbranding: 1, // Minimal YouTube branding
                                                    showinfo: 0, // Hide video title, uploader
                                                    iv_load_policy: 3, // Disable annotations
                                                    cc_load_policy: 0, // Disable closed captions
                                                    fs: 0, // Disable fullscreen button
                                                },
                                            }}
                                            onReady={onPlayerReady}
                                            onStateChange={onPlayerStateChange}
                                            className="w-full h-full"
                                            key={currentSongCombined.id} // Ensure re-render on song change
                                        />
                                        {/* Transparent overlay to block YouTube\'s hover UI */}
                                        <div className="absolute top-0 left-0 w-full h-full z-10 bg-transparent"></div>
                                    </div>
                                ) : (
                                    // Non-admin view: Thumbnail and Info
                                    <div className="w-full aspect-video bg-black flex flex-col items-center justify-center text-white p-4 rounded-lg overflow-hidden">
                                        {currentSongCombined ? (
                                            <>
                                                <img
                                                    src={
                                                        currentSongCombined.thumbnail
                                                    }
                                                    alt={
                                                        currentSongCombined.title
                                                    }
                                                    className="h-auto max-h-[calc(100%-60px)] object-contain mb-2 rounded" // Added w-full
                                                />
                                                <p className="text-lg font-semibold truncate w-full text-center">
                                                    {currentSongCombined.title}
                                                </p>
                                                <p className="text-sm text-gray-400">
                                                    Added by:{" "}
                                                    {
                                                        currentSongCombined.addedBy
                                                    }
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <Music className="h-16 w-16 text-gray-500 mb-4" />
                                                <p className="text-xl font-medium">
                                                    No song is currently
                                                    playing.
                                                </p>
                                                <p className="text-gray-400">
                                                    Add a song to the queue to
                                                    get started!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                // Loading or no current song view (when player might not be ready or no song)
                                <div className="w-full aspect-video bg-black flex flex-col items-center justify-center text-white p-4 rounded-lg">
                                    {combinedLoading && isInitialized ? ( // Check combinedLoading and if initialization has completed
                                        <>
                                            <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                                            <p>Loading player...</p>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center">
                                            <Music className="h-16 w-16 text-gray-500 mb-4" />
                                            <p className="text-xl font-medium">
                                                No song is currently playing.
                                            </p>
                                            <p className="text-gray-400">
                                                Add a song to the queue to get
                                                started!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Player Controls - Visible only to admin and if showControls is true */}
                            {isAdmin && showControls && (
                                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 bg-black/50 p-2 rounded-full z-20 border border-white/20">
                                    <Button
                                        onClick={handlePlayPause}
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20 rounded-full"
                                        aria-label={
                                            isPlayingCombined ? "Pause" : "Play"
                                        }
                                    >
                                        {isPlayingCombined ? (
                                            <Pause className="h-5 w-5" />
                                        ) : (
                                            <Play className="h-5 w-5" />
                                        )}
                                    </Button>
                                    <Button
                                        onClick={handleSkip}
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20 rounded-full"
                                        aria-label="Skip next"
                                    >
                                        <SkipForward className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        onClick={handleMute}
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20 rounded-full"
                                        aria-label={
                                            isMutedCombined ? "Unmute" : "Mute"
                                        }
                                    >
                                        {isMutedCombined ? (
                                            <VolumeX className="h-5 w-5" />
                                        ) : (
                                            <Volume2 className="h-5 w-5" />
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Fullscreen, Sidebar, and Controls Toggle Buttons */}
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={toggleControls} // Added onClick handler
                                        className="bg-black/30 text-white hover:bg-black/50 rounded-full"
                                        aria-label={
                                            showControls
                                                ? "Hide Controls"
                                                : "Show Controls"
                                        }
                                    >
                                        {showControls ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleSidebar}
                                    className="bg-black/30 text-white hover:bg-black/50 rounded-full"
                                >
                                    {showSidebar ? (
                                        <PanelRightClose className="h-5 w-5" />
                                    ) : (
                                        <PanelRightOpen className="h-5 w-5" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleFullscreen}
                                    className="bg-black/30 text-white hover:bg-black/50 rounded-full"
                                >
                                    {isFullscreen ? (
                                        <Minimize2 className="h-5 w-5" />
                                    ) : (
                                        <Maximize2 className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar with tabs for Search, Users, and Queue */}
                {showSidebar && (
                    <div
                        className="w-full md:w-96 bg-gray-800/30 border-l border-gray-800 p-4 flex flex-col h-full overflow-scroll tab-holder hide-scrollbar"
                        style={{
                            scrollbarWidth: "none",
                            msOverflowStyle: "none",
                        }}
                    >
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="flex-1 flex flex-col h-full"
                        >
                            <TabsList
                                className={cn(
                                    "grid mb-4",
                                    isAdmin ? "grid-cols-3" : "grid-cols-2"
                                )}
                            >
                                <TabsTrigger value="search">Search</TabsTrigger>
                                <TabsTrigger value="queue">Queue</TabsTrigger>
                                {isAdmin && (
                                    <TabsTrigger value="users">
                                        Users
                                    </TabsTrigger>
                                )}
                            </TabsList>
                            <div>
                                {/* Search Tab */}
                                <TabsContent
                                    value="search"
                                    className="flex-1 flex flex-col overflow-hidden"
                                >
                                    <div className="flex mb-4">
                                        <Input
                                            type="text"
                                            placeholder="Search for songs..."
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            className="bg-gray-700 border-gray-600 mr-2"
                                            onKeyDown={(e) =>
                                                e.key === "Enter" &&
                                                handleSearch()
                                            }
                                        />
                                        <Button
                                            onClick={handleSearch}
                                            className="bg-purple-600 hover:bg-purple-500"
                                            disabled={isSearching}
                                        >
                                            {isSearching ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Search className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>

                                    <ScrollArea
                                        className="flex-1 bg-gray-800/50 rounded-lg"
                                        orientation="vertical"
                                    >
                                        <div className="space-y-3 p-3">
                                            {searchResults.map((result) => (
                                                <motion.div
                                                    key={result.id.videoId}
                                                    initial={{
                                                        opacity: 0,
                                                        y: 10,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    className="flex items-start bg-gray-700/70 hover:bg-gray-700/90 rounded-lg p-3 transition-colors w-full border border-gray-700"
                                                >
                                                    <div className="flex-shrink-0 mr-3">
                                                        <img
                                                            src={
                                                                result.snippet
                                                                    .thumbnails
                                                                    .default
                                                                    .url ||
                                                                "/placeholder.svg"
                                                            }
                                                            alt={
                                                                result.snippet
                                                                    .title
                                                            }
                                                            className="w-14 h-10 object-cover rounded shadow-md"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col flex-grow min-w-0">
                                                        <div className="flex justify-between items-center w-full">
                                                            <p
                                                                className="text-xs font-medium pr-2 break-words text-white"
                                                                style={{
                                                                    wordBreak:
                                                                        "break-word",
                                                                }}
                                                            >
                                                                {result.snippet.title.replace(
                                                                    /&(#39|amp|quot|lt|gt);/g,
                                                                    (
                                                                        match: string
                                                                    ) => {
                                                                        switch (
                                                                            match
                                                                        ) {
                                                                            case "&#39;":
                                                                                return "'";
                                                                            case "&amp;":
                                                                                return "&";
                                                                            case "&quot;":
                                                                                return '"';
                                                                            case "&lt;":
                                                                                return "<";
                                                                            case "&gt;":
                                                                                return ">";
                                                                            default:
                                                                                return match;
                                                                        }
                                                                    }
                                                                )}
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleAddToQueue(
                                                                        result
                                                                    )
                                                                }
                                                                className="bg-purple-600 hover:bg-purple-500 shrink-0 ml-2 h-7 w-7 p-0 rounded-full"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-gray-300 mt-1">
                                                            {
                                                                result.snippet
                                                                    .channelTitle
                                                            }
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))}

                                            {isSearching && (
                                                <div className="text-center py-8 text-gray-400">
                                                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                                                    <p>
                                                        Searching for songs...
                                                    </p>
                                                </div>
                                            )}

                                            {!isSearching &&
                                                searchQuery &&
                                                searchResults.length === 0 && (
                                                    <div className="text-center py-8 text-gray-400">
                                                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p>
                                                            No results found.
                                                            Try a different
                                                            search term.
                                                        </p>
                                                    </div>
                                                )}

                                            {!isSearching && !searchQuery && (
                                                <div className="text-center py-8 text-gray-400">
                                                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p>
                                                        Search for your favorite
                                                        songs to sing
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                {/* Queue Tab */}
                                <TabsContent
                                    value="queue"
                                    className="flex-1 flex flex-col overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium">
                                            Song Queue
                                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-purple-600/30 px-2.5 py-0.5 text-xs font-medium text-purple-200 border border-purple-500/30">
                                                {queueCombined.length}
                                            </span>
                                        </h3>
                                    </div>
                                    <ScrollArea
                                        orientation="vertical"
                                        className="flex-1 bg-gray-800/50 rounded-lg"
                                    >
                                        {queueCombined.length > 0 ? (
                                            <div className="space-y-3 p-3">
                                                <AnimatePresence>
                                                    {queueCombined.map(
                                                        (song, index) => (
                                                            <motion.div
                                                                key={`${song.id}-${index}`}
                                                                initial={{
                                                                    opacity: 0,
                                                                    x: 20,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    x: 0,
                                                                }}
                                                                exit={{
                                                                    opacity: 0,
                                                                    x: -20,
                                                                }}
                                                                className="flex items-center bg-gray-700/70 hover:bg-gray-700/90 rounded-lg p-2 group w-full transition-colors border border-gray-700"
                                                            >
                                                                <div className="flex-shrink-0 mr-2 relative">
                                                                    <div className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center bg-purple-600 rounded-full text-xs font-medium border border-gray-700 shadow-md">
                                                                        {index +
                                                                            1}
                                                                    </div>
                                                                    <img
                                                                        src={
                                                                            song.thumbnail ||
                                                                            "/placeholder.svg"
                                                                        }
                                                                        alt={
                                                                            song.title
                                                                        }
                                                                        className="w-10 h-8 object-cover rounded shadow-md"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col flex-grow min-w-0">
                                                                    <div className="flex justify-between items-center w-full">
                                                                        <div className="flex-1 min-w-0 pr-2">
                                                                            <p
                                                                                className="text-xs font-medium break-words text-white"
                                                                                style={{
                                                                                    wordBreak:
                                                                                        "break-word",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    song.title
                                                                                }
                                                                            </p>
                                                                            <p className="text-xs text-gray-300">
                                                                                <span className="text-purple-300">
                                                                                    {
                                                                                        song.addedBy
                                                                                    }
                                                                                </span>
                                                                            </p>
                                                                        </div>
                                                                        {(isAdmin ||
                                                                            song.addedBy ===
                                                                                userName) && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() =>
                                                                                    handleRemoveFromQueue(
                                                                                        song.id,
                                                                                        song.firebaseKey,
                                                                                        song.addedBy
                                                                                    )
                                                                                }
                                                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20 shrink-0 h-6 w-6 p-0 rounded-full ml-1 transition-all"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center p-6">
                                                <div className="text-center bg-gray-800/70 p-6 rounded-lg border border-gray-700 shadow-lg">
                                                    <Music className="h-12 w-12 mx-auto mb-3 text-purple-400 opacity-70" />
                                                    <p className="text-lg font-medium text-white mb-1">
                                                        Queue is empty
                                                    </p>
                                                    <p className="text-sm text-gray-300">
                                                        Search for your favorite
                                                        songs to add them here
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </TabsContent>

                                {/* Users Tab */}
                                {isAdmin && (
                                    <TabsContent
                                        value="users"
                                        className="flex-1 flex flex-col overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-medium">
                                                Users in Room
                                                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-purple-600/30 px-2.5 py-0.5 text-xs font-medium text-purple-200 border border-purple-500/30">
                                                    {users.length}
                                                </span>
                                            </h3>
                                        </div>
                                        <ScrollArea
                                            orientation="vertical"
                                            className="flex-1 bg-gray-800/50 rounded-lg"
                                        >
                                            {users.length > 0 ? (
                                                <div className="space-y-3 p-3">
                                                    {users.map((user) => (
                                                        <div
                                                            key={user.id}
                                                            className="mb-2 flex items-center justify-between rounded-lg bg-gray-800 p-3"
                                                        >
                                                            <span className="text-sm text-white">
                                                                {user.name}
                                                                {user.isAdmin && (
                                                                    <span className="ml-2 text-xs text-yellow-400">
                                                                        (Admin)
                                                                    </span>
                                                                )}
                                                                {user.id ===
                                                                    firebaseUserId && (
                                                                    <span className="ml-2 text-xs text-green-400">
                                                                        (You)
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center">
                                                    <div className="text-center text-gray-400">
                                                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p>No users in room</p>
                                                        <p className="text-sm">
                                                            Share the room code
                                                            to invite others
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </TabsContent>
                                )}
                            </div>
                        </Tabs>
                    </div>
                )}
            </div>
        </main>
    );
}
