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
    Mic,
    MicOff,
    Volume1,
    Volume,
    Award, // Added for scoring feature
    Trophy, // Added for scoring feature
    Link2, // Spec 2: paste-link entry point
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
import {
    searchYouTubeViaApi,
    extractYouTubeVideoId,
    buildYouTubeThumbnail,
    enrichYouTubeIds,
    genericBypassTitle,
    YouTubeQuotaExceededError,
    type BypassPreview,
} from "@/lib/youtube";
import type { ComponentType } from "react";
import useMicrophone from "@/hooks/useMicrophone";
import { Slider } from "@/components/ui/slider";
import { ScoreDisplayModal } from "@/components/score-display"; // Import the ScoreDisplayModal
import { HighScores } from "@/components/high-scores"; // Import the HighScores component
import { generatePerformanceScore } from "@/lib/scoring-service"; // Import the scoring service
import { RovingList } from "@/components/ui/roving-list"; // Spec 3: D-pad list navigation
import { useTvBack } from "@/hooks/use-tv-shortcuts"; // Spec 3: Back button on remote
import { ReactionPicker } from "@/components/reaction-picker";
import { ReactionOverlay } from "@/components/reaction-overlay";
import { ExperimentalBadge } from "@/components/experimental-badge";
import { useFlags } from "@/hooks/use-flags";
import {
    createRoom,
    checkRoomExists,
    seedAdminUser,
    addSongToQueue,
    // removeSongFromQueue, // Will use safelyRemoveSong from the combined hook
    addUserToRoom,
    removeUserFromRoom,
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
import {
    MicrophoneRTCManager,
    AdminRTCManager,
    updateUserMicStatus,
    updateUserMicEchoLevel,
    updateUserMicVolumeLevel,
} from "@/lib/webrtc-service";
import {
    DEFAULT_MIC_VOLUME_LEVEL,
    micVolumeLevelToGain,
    normalizeMicVolumeLevel,
} from "@/lib/microphone-audio";

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
    isMicOn?: boolean;
    isMutedByAdmin?: boolean;
}

type RoomValidationStatus =
    | "idle"
    | "validating_length"
    | "checking_existence"
    | "valid"
    | "invalid_redirecting";

// Spec 2: shared preview card used by both the search-bar and dialog paths.
// Renders thumbnail + title + channel/duration + Add-to-Queue button.
// Title and channel start as the generic placeholder and are swapped in
// when the best-effort enrichment resolves.
function BypassPreviewCard({
    preview,
    onAdd,
}: {
    preview: BypassPreview;
    onAdd: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="bypass-preview-card"
            className="flex items-start bg-gray-700/70 rounded-lg p-3 border border-purple-400/40 w-full"
        >
            <div className="flex-shrink-0 mr-3">
                <img
                    src={preview.thumbnail}
                    alt={preview.title}
                    className="w-20 h-14 object-cover rounded shadow-md"
                />
            </div>
            <div className="flex flex-col flex-grow min-w-0">
                <div className="flex justify-between items-start w-full gap-2">
                    <div className="flex flex-col min-w-0">
                        <p
                            className="text-xs font-medium break-words text-white"
                            style={{ wordBreak: "break-word" }}
                        >
                            {preview.title}
                        </p>
                        <p className="text-[11px] text-gray-300 mt-0.5">
                            {preview.channel || "YouTube"}{" "}
                            {preview.duration ? `· ${preview.duration}` : ""}
                        </p>
                        {preview.isEnriching && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                Loading details…
                            </p>
                        )}
                        {preview.enrichmentFailed && !preview.isEnriching && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                Details unavailable — video will still play.
                            </p>
                        )}
                    </div>
                    <Button
                        size="sm"
                        onClick={onAdd}
                        className="bg-purple-600 hover:bg-purple-500 shrink-0 h-7 px-2 rounded"
                        data-testid="bypass-add-to-queue"
                    >
                        <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

export default function Room() {
    const params = useParams();
    const router = useRouter();
    const searchParamsHook = useSearchParams();
    const roomId = params.id as string;
    const { flags } = useFlags();

    const ROOM_ID_LENGTH = 6;

    const [roomValidationStatus, setRoomValidationStatus] =
        useState<RoomValidationStatus>("idle");
    const [showNamePrompt, setShowNamePrompt] = useState(false); // Initialize to false

    const isAdmin = searchParamsHook.get("admin") === "true";
    const [userName, setUserName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    // Spec 2: bypass preview state (shared by search-bar and dialog paths)
    const [bypassPreview, setBypassPreview] = useState<BypassPreview | null>(
        null
    );
    // Spec 2: paste-link dialog state
    const [directLinkOpen, setDirectLinkOpen] = useState(false);
    const [directLinkInput, setDirectLinkInput] = useState("");
    const [directLinkPreview, setDirectLinkPreview] =
        useState<BypassPreview | null>(null);

    // Throttle: minimum gap between consecutive searches/bypass renders.
    // Prevents button-spam and Enter-key-spam from exhausting the API quota.
    // Refs persist across renders without triggering re-renders themselves.
    const MIN_SEARCH_INTERVAL_MS = 1500;
    const lastSearchAtRef = useRef<number>(0);
    const lastBypassAtRef = useRef<number>(0);
    const pendingSongIdsRef = useRef(new Set<string>());
    // showNamePrompt is now initialized to false, its logic is handled in initializeRoom
    const [activeTab, setActiveTab] = useState("search");
    const [showSidebar, setShowSidebar] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [origin, setOrigin] = useState("");
    const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Scoring feature states
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [scoringSong, setScoringSong] = useState<Song | null>(null);
    const scoringSongRef = useRef<Song | null>(null);
    const [currentScore, setCurrentScore] = useState(0);
    const [showHighScores, setShowHighScores] = useState(false);

    // Spec 3: TV remote Back button — closes the topmost dialog instead of
    // navigating out of the room. Radix Dialog already traps Esc, so this
    // handles the Android TV remote Back button + keyboard Escape parity.
    useTvBack({
        isOpen: directLinkOpen,
        onClose: () => setDirectLinkOpen(false),
    });
    useTvBack({
        isOpen: showScoreModal,
        onClose: () => undefined,
    });
    useTvBack({
        isOpen: showHighScores,
        onClose: () => setShowHighScores(false),
    });

    // Microphone feature states
    const [isMutedByAdmin, setIsMutedByAdmin] = useState(false);
    const [micEchoLevel, setMicEchoLevel] = useState(0);
    const [micVolumeLevel, setMicVolumeLevel] = useState(
        DEFAULT_MIC_VOLUME_LEVEL
    );
    // Use the useMicrophone hook to handle microphone access
    const {
        isMicOn,
        mediaStream,
        error: micError,
        permissionStatus: micPermissionStatus,
        startMicrophone,
        stopMicrophone,
    } = useMicrophone();

    // Volume control states
    const [videoVolume, setVideoVolume] = useState(100); // 0-100 for video volume
    const [showVolumeSlider, setShowVolumeSlider] = useState(false); // Show/hide video volume slider
    // WebRTC managers refs
    const micRTCManagerRef = useRef<MicrophoneRTCManager | null>(null);
    const adminRTCManagerRef = useRef<AdminRTCManager | null>(null);
    const [connectedUsers, setConnectedUsers] = useState<{
        [userId: string]: boolean;
    }>({});

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

    useEffect(() => {
        if (isAdmin || !firebaseUserId) return;
        const currentUser = users.find((user) => user.id === firebaseUserId);
        if (currentUser) {
            setMicEchoLevel(currentUser.micEchoLevel ?? 0);
            setMicVolumeLevel(
                normalizeMicVolumeLevel(
                    currentUser.micVolumeLevel ?? DEFAULT_MIC_VOLUME_LEVEL
                )
            );
        }
    }, [firebaseUserId, isAdmin, users]);

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
                // SECURITY: previously admins could land on a random 6-char
                // URL with `?admin=true` and have the app auto-create that
                // room in RTDB — i.e., anyone could squat a room ID by
                // guessing one. Now both guests and admins are redirected
                // to /room-not-found for unknown rooms. To create a new
                // room, admins must use the Create Room flow on `/`
                // (which generates a fresh ID and redirects to it).
                setRoomValidationStatus("invalid_redirecting");
                router.push("/room-not-found");
            }
        };
        check();
    }, [roomId, router, roomValidationStatus, isAdmin]); // Check for microphone permissions when the component loads
    useEffect(() => {
        // This is now handled by the useMicrophone hook
        // We just need to handle any errors that occur
        if (micError) {
            toast({
                title: "Microphone Error",
                description: micError,
                variant: "destructive",
            });
        }
    }, [micError]); // Handle microphone toggle

    const handleMicToggle = async () => {
        // Don't allow toggling if the admin has muted the user
        if (isMutedByAdmin) {
            return;
        }

        try {
            if (!isMicOn) {
                // Start the microphone
                const stream = await startMicrophone();

                if (stream && !isAdmin && firebaseUserId) {
                    // Initialize the WebRTC connection
                    try {
                        // Create a new MicrophoneRTCManager if it doesn't exist
                        if (!micRTCManagerRef.current) {
                            micRTCManagerRef.current = new MicrophoneRTCManager(
                                roomId,
                                firebaseUserId
                            ); // Set up mute callback
                            micRTCManagerRef.current.setOnMutedCallback(
                                (isMuted: boolean) => {
                                    setIsMutedByAdmin(isMuted);
                                    if (isMuted && isMicOn) {
                                        // Turn off the microphone if the admin mutes the user
                                        stopMicrophone();

                                        // Show notification to user
                                        toast({
                                            title: "Microphone disabled",
                                            description:
                                                "The host has muted your microphone",
                                            variant: "destructive",
                                        });

                                        // Close the WebRTC connection when muted by admin
                                        if (
                                            micRTCManagerRef.current &&
                                            firebaseUserId
                                        ) {
                                            micRTCManagerRef.current
                                                .close()
                                                .catch((err) =>
                                                    console.error(
                                                        "Error closing WebRTC connection after admin mute:",
                                                        err
                                                    )
                                                );
                                        }
                                    } else if (!isMuted && !isMicOn) {
                                        // Notify user they've been unmuted but need to turn mic back on
                                        toast({
                                            title: "Microphone unmuted",
                                            description:
                                                "The host has unmuted you. You can now turn your microphone back on.",
                                        });
                                    }
                                }
                            );
                        }

                        // Initialize the WebRTC connection with the media stream
                        await micRTCManagerRef.current.initialize(stream);

                        // Update the mic status in Firebase
                        await updateUserMicStatus(roomId, firebaseUserId, true);

                        toast({
                            title: "Microphone connected",
                            description: "Your microphone is now active",
                        });
                    } catch (rtcError) {
                        console.error("Error initializing WebRTC:", rtcError);
                        // Stop the microphone if the WebRTC connection fails
                        stopMicrophone();

                        toast({
                            title: "Connection error",
                            description:
                                "Failed to connect your microphone to the room",
                            variant: "destructive",
                        });
                    }
                }
            } else {
                // Stop the microphone
                stopMicrophone();

                // Close the WebRTC connection
                if (micRTCManagerRef.current && firebaseUserId) {
                    await micRTCManagerRef.current.close();

                    // Update the mic status in Firebase
                    await updateUserMicStatus(roomId, firebaseUserId, false);

                    toast({
                        title: "Microphone disconnected",
                        description: "Your microphone is now off",
                    });
                }
            }
        } catch (error) {
            console.error("Error toggling microphone:", error);
            // Error handling is done by the hook itself
            toast({
                title: "Microphone error",
                description:
                    "An unexpected error occurred with your microphone.",
                variant: "destructive",
            });
        }
    };

    // Initialize WebRTC for the admin
    useEffect(() => {
        if (
            !isAdmin ||
            !isInitialized ||
            !roomId ||
            !roomData?.micFeatureEnabled
        ) {
            return;
        }

        const initializeAdminRTC = async () => {
            try {
                // Create a new AdminRTCManager if it doesn't exist
                if (!adminRTCManagerRef.current) {
                    adminRTCManagerRef.current = new AdminRTCManager(roomId);

                    // Set up user stream callback
                    adminRTCManagerRef.current.setOnUserStreamCallback(
                        (userId, stream, event) => {
                            setConnectedUsers((prev) => {
                                const updated = { ...prev };
                                if (event === "add") {
                                    updated[userId] = true;
                                } else {
                                    delete updated[userId];
                                }
                                return updated;
                            });
                            if (stream && event === "add") {
                                console.log(
                                    `User ${userId} microphone connected`
                                );

                                toast({
                                    title: "User microphone connected",
                                    description: `A user has turned on their microphone`,
                                });
                            } else if (event === "remove") {
                                console.log(
                                    `User ${userId} microphone disconnected`
                                );
                            }
                        }
                    );

                    // Initialize the AdminRTCManager
                    await adminRTCManagerRef.current.initialize();

                    console.log("Admin WebRTC initialized");
                }
            } catch (error) {
                console.error("Error initializing admin WebRTC:", error);
                toast({
                    title: "WebRTC error",
                    description: "Failed to initialize microphone service",
                    variant: "destructive",
                });
            }
        };

        initializeAdminRTC();

        // Cleanup
        return () => {
            if (adminRTCManagerRef.current) {
                // Close all connections
                adminRTCManagerRef.current.close();
                adminRTCManagerRef.current = null;
            }
        };
    }, [isAdmin, isInitialized, roomId, roomData?.micFeatureEnabled]);

    // Echo is chosen by each phone user; the host only applies that level locally.
    useEffect(() => {
        const manager = adminRTCManagerRef.current;
        if (!isAdmin || !manager || !roomData?.micFeatureEnabled) return;

        users.forEach((user) => {
            if (!user.isAdmin) {
                manager.setUserVolume(
                    user.id,
                    micVolumeLevelToGain(
                        user.micVolumeLevel ?? DEFAULT_MIC_VOLUME_LEVEL
                    )
                );
                manager.setUserMicEchoLevel(user.id, user.micEchoLevel ?? 0);
            }
        });
    }, [isAdmin, roomData?.micFeatureEnabled, users]);

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
                    // SECURITY: removed the auto-create-on-missing-room
                    // branch. Unknown admin URLs are now rejected by the
                    // existence check above, so reaching this code means
                    // the room already exists (created from `/`). We
                    // idempotently seed the admin user via seedAdminUser
                    // — NOT createRoom — to avoid re-running cleanup
                    // and overwriting room metadata (micFeatureEnabled /
                    // scorerEnabled) on every admin page mount.
                    await seedAdminUser(roomId, adminUser);
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

        initializeRoomLogic(); // Clean up when component unmounts
        return () => {
            if (
                firebaseUserId &&
                firebaseUserId !== "admin" &&
                roomValidationStatus === "valid"
            ) {
                // Clean up WebRTC connection if active
                if (micRTCManagerRef.current) {
                    micRTCManagerRef.current
                        .close()
                        .catch((err) =>
                            console.error(
                                "Error closing WebRTC connection:",
                                err
                            )
                        );
                    micRTCManagerRef.current = null;
                }

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

    // Spec 2: kick off a bypass preview + best-effort enrichment.
    // Returns the rendered preview (or null if the input wasn't a URL/ID).
    const triggerBypassPreview = async (
        rawInput: string,
        target: "search" | "dialog"
    ) => {
        const extracted = extractYouTubeVideoId(rawInput);
        if (!extracted) return null;

        const initial: BypassPreview = {
            videoId: extracted.videoId,
            title: genericBypassTitle(extracted.videoId),
            thumbnail: buildYouTubeThumbnail(extracted.videoId),
            isEnriching: true,
        };

        if (target === "search") {
            setBypassPreview(initial);
            setSearchResults([]);
        } else {
            setDirectLinkPreview(initial);
        }

        // Best-effort enrichment. Never throws; never blocks the UI.
        try {
            const items = await enrichYouTubeIds([extracted.videoId]);
            const enriched = items.find((it) => it.id === extracted.videoId);
            if (enriched) {
                const updated: BypassPreview = {
                    ...initial,
                    title: enriched.title || initial.title,
                    thumbnail: enriched.thumbnail || initial.thumbnail,
                    channel: enriched.channel,
                    duration: enriched.duration,
                    isEnriching: false,
                    enrichmentFailed: !enriched.title,
                };
                if (target === "search") {
                    setBypassPreview((prev) =>
                        prev && prev.videoId === extracted.videoId
                            ? updated
                            : prev
                    );
                } else {
                    setDirectLinkPreview((prev) =>
                        prev && prev.videoId === extracted.videoId
                            ? updated
                            : prev
                    );
                }
            } else {
                // 200 but no items → enrichment unavailable
                const updated: BypassPreview = {
                    ...initial,
                    isEnriching: false,
                    enrichmentFailed: true,
                };
                if (target === "search") {
                    setBypassPreview((prev) =>
                        prev && prev.videoId === extracted.videoId
                            ? updated
                            : prev
                    );
                } else {
                    setDirectLinkPreview((prev) =>
                        prev && prev.videoId === extracted.videoId
                            ? updated
                            : prev
                    );
                }
            }
        } catch {
            const updated: BypassPreview = {
                ...initial,
                isEnriching: false,
                enrichmentFailed: true,
            };
            if (target === "search") {
                setBypassPreview((prev) =>
                    prev && prev.videoId === extracted.videoId ? updated : prev
                );
            } else {
                setDirectLinkPreview((prev) =>
                    prev && prev.videoId === extracted.videoId ? updated : prev
                );
            }
        }

        return initial;
    };

    // Spec 2: queue the song from a preview card. Used by both the search-bar
    // preview and the dialog preview.
    const queueFromPreview = async (preview: BypassPreview) => {
        if (pendingSongIdsRef.current.has(preview.videoId)) return;
        pendingSongIdsRef.current.add(preview.videoId);
        const newSong: Song = {
            id: preview.videoId,
            title: preview.title,
            thumbnail: preview.thumbnail,
            addedBy: userName,
        };
        try {
            await addSongToQueue(roomId, newSong);
            toast({
                title: "Song Added",
                description: `"${preview.title}" added to queue`,
            });
        } finally {
            pendingSongIdsRef.current.delete(preview.videoId);
        }
    };

    // Returns true if the throttle window is still active; updates the ref
    // on success. Used to block button-spam and Enter-key-spam. On TV-style
    // remotes where the user can't see why a button-press was a no-op, we
    // show a soft toast the first time the throttle blocks (and then suppress
    // repeats for ~2s).
    const lastCooldownToastAtRef = useRef<number>(0);
    const consumeThrottle = (ref: React.MutableRefObject<number>): boolean => {
        const now = Date.now();
        if (now - ref.current < MIN_SEARCH_INTERVAL_MS) {
            if (now - lastCooldownToastAtRef.current > 2000) {
                lastCooldownToastAtRef.current = now;
                const remaining = Math.ceil(
                    (MIN_SEARCH_INTERVAL_MS - (now - ref.current)) / 1000
                );
                toast({
                    title: "Slow down a sec…",
                    description: `Please wait ${remaining}s before searching again.`,
                    duration: 1500,
                });
            }
            return false;
        }
        ref.current = now;
        return true;
    };

    // Handle search
    const handleSearch = async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        // 1. URL/ID bypass — render preview card instead of auto-adding.
        // Bypass previews are cheap (no API call) but enrichment is, so we
        // still throttle to avoid enrichment-spam from paste-spam.
        const extracted = extractYouTubeVideoId(trimmed);
        if (extracted) {
            if (!consumeThrottle(lastBypassAtRef)) return;
            await triggerBypassPreview(trimmed, "search");
            // Keep the input so the user can see what they pasted; clearing
            // happens after they click "Add to Queue".
            return;
        }

        // 2. Free-text query — go through the rotating-key API route.
        if (!consumeThrottle(lastSearchAtRef)) return;
        try {
            setIsSearching(true);
            setBypassPreview(null);
            const results = await searchYouTubeViaApi(trimmed);
            setSearchResults(results || []);
        } catch (error) {
            console.error("Error searching YouTube:", error);

            if (error instanceof YouTubeQuotaExceededError) {
                toast({
                    title: "Daily search limit reached",
                    description:
                        "Paste a direct YouTube link or Video ID to add your song!",
                    variant: "destructive",
                    duration: 8000,
                });
                setSearchResults([]);
            } else {
                toast({
                    title: "Search Error",
                    description:
                        "Failed to search for videos. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsSearching(false);
        }
    };

    // Spec 2: dialog "Add to Queue" handler
    const handleDirectLinkAdd = async () => {
        if (!directLinkPreview) return;
        // Throttle prevents double-click from queueing the same song twice.
        if (!consumeThrottle(lastBypassAtRef)) return;
        try {
            await queueFromPreview(directLinkPreview);
            setDirectLinkOpen(false);
            setDirectLinkInput("");
            setDirectLinkPreview(null);
            setActiveTab("queue");
        } catch (error) {
            console.error("Error adding direct YouTube link:", error);
            toast({
                title: "Error",
                description: "Failed to add video to queue",
                variant: "destructive",
            });
        }
    };

    // Spec 2: dialog input change → live preview (throttled to avoid
    // enrichment-spam when the user is still typing/pasting).
    const handleDirectLinkInputChange = (value: string) => {
        setDirectLinkInput(value);
        const extracted = extractYouTubeVideoId(value);
        if (extracted) {
            if (!consumeThrottle(lastBypassAtRef)) return;
            void triggerBypassPreview(value, "dialog");
        } else {
            setDirectLinkPreview(null);
        }
    };

    // Handle adding song to queue
    const handleAddToQueue = async (result: any) => {
        const videoId = result.id.videoId as string;
        if (pendingSongIdsRef.current.has(videoId)) return;
        pendingSongIdsRef.current.add(videoId);
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
                id: videoId,
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

            // Switch to queue tab after adding
            setActiveTab("queue");
        } catch (error) {
            console.error("Error adding song to queue:", error);
            toast({
                title: "Error",
                description: "Failed to add song to queue",
                variant: "destructive",
            });
        } finally {
            pendingSongIdsRef.current.delete(videoId);
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
        if (isAdmin && currentSongCombined && !scoringSongRef.current) {
            await queueActions.handleSongEnded(); // Use new action
        }
    };

    // Handle scoring performance
    const handleShowScore = (endedSong: Song) => {
        if (roomData?.scorerEnabled && !scoringSongRef.current) {
            scoringSongRef.current = endedSong;
            setScoringSong(endedSong);
            setShowScoreModal(true);
        }
    };

    // Finish scoring before advancing to the next song.
    const handleCloseScoreModal = async () => {
        const endedSong = scoringSongRef.current;
        setShowScoreModal(false);
        setScoringSong(null);
        scoringSongRef.current = null;

        if (endedSong) {
            await queueActions.handleSongEnded(endedSong);
        }
    };

    // Handle video volume change
    const handleVideoVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVideoVolume(newVolume);

        if (playerRef.current && isAdmin) {
            try {
                if (newVolume === 0) {
                    playerRef.current.mute();
                    updatePlayerState(roomId, isPlayingCombined, true);
                } else {
                    if (isMutedCombined) {
                        playerRef.current.unMute();
                        updatePlayerState(roomId, isPlayingCombined, false);
                    }
                    playerRef.current.setVolume(newVolume);
                }
            } catch (error) {
                console.error("Error setting video volume:", error);
            }
        }
    };

    const saveMicEchoLevel = async (value: number[]) => {
        const level = value[0] ?? 0;
        setMicEchoLevel(level);
        if (!firebaseUserId || !roomId) return;

        try {
            await updateUserMicEchoLevel(roomId, firebaseUserId, level);
        } catch (error) {
            console.error("Could not save microphone echo level:", error);
            const savedLevel =
                users.find((user) => user.id === firebaseUserId)?.micEchoLevel ??
                0;
            setMicEchoLevel(savedLevel);
            toast({
                title: "Echo setting not saved",
                description: "Please try adjusting it again.",
                variant: "destructive",
            });
        }
    };

    const saveMicVolumeLevel = async (value: number[]) => {
        const level = normalizeMicVolumeLevel(value[0] ?? DEFAULT_MIC_VOLUME_LEVEL);
        setMicVolumeLevel(level);
        if (!firebaseUserId || !roomId) return;

        try {
            await updateUserMicVolumeLevel(roomId, firebaseUserId, level);
        } catch (error) {
            console.error("Could not save microphone volume level:", error);
            const savedLevel = users.find(
                (user) => user.id === firebaseUserId
            )?.micVolumeLevel;
            setMicVolumeLevel(
                normalizeMicVolumeLevel(
                    savedLevel ?? DEFAULT_MIC_VOLUME_LEVEL
                )
            );
            toast({
                title: "Volume setting not saved",
                description: "Please try adjusting it again.",
                variant: "destructive",
            });
        }
    };

    // Toggle volume slider visibility
    const toggleVolumeSlider = () => {
        setShowVolumeSlider(!showVolumeSlider);
    };

    // Toggle controls visibility
    const toggleControls = () => {
        setShowControls(!showControls);
    };

    // Toggle sidebar visibility
    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);

        // Handle fullscreen API if needed
        if (mainContainerRef.current) {
            if (!isFullscreen) {
                if (mainContainerRef.current.requestFullscreen) {
                    mainContainerRef.current.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
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
                    <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
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
            // Set initial volume
            playerRef.current.setVolume(videoVolume);
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
            const endedSong = currentSongCombined;
            if (!endedSong) return;

            if (roomData?.scorerEnabled) {
                // Keep the finished song current while it is being scored.
                handleShowScore(endedSong);
            } else {
                await queueActions.handleSongEnded(endedSong);
            }
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

    return (
        <main
            className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white"
            ref={mainContainerRef}
        >
            <Toaster />

            {roomData?.reactionsEnabled && (
                <ReactionOverlay roomId={roomId} isAdmin={isAdmin} />
            )}
            {!isAdmin && roomData?.reactionsEnabled && userName.trim() && (
                <ReactionPicker
                    roomId={roomId}
                    userName={userName}
                    experimental={flags.reactionsExperimental}
                />
            )}

            {/* Score Display Modal */}
            <ScoreDisplayModal
                open={showScoreModal}
                onClose={handleCloseScoreModal}
                roomId={roomId}
                currentUser={
                    users.find((user) => user.id === firebaseUserId) || null
                }
                currentSong={scoringSong ?? currentSongCombined}
            />

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
                            </DialogTrigger>{" "}
                            <DialogContent className="bg-gray-900 border-gray-700">
                                <DialogHeader>
                                    <DialogTitle className="text-center">
                                        Share the room
                                    </DialogTitle>
                                </DialogHeader>
                                {/* Horizontal layout: QR left, Code+Link stacked right */}
                                <div className="flex flex-col sm:flex-row items-start justify-center gap-6 p-4">
                                    {/* Left column: QR code */}
                                    <div className="flex-shrink-0 flex items-center justify-center mx-auto sm:mx-0">
                                        <div className="bg-white p-3 rounded-lg">
                                            {origin && (
                                                <QRCodeSVG
                                                    value={`${origin}/join?room=${roomId}`}
                                                    size={160}
                                                    level="H"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Right column: Code + Link stacked vertically */}
                                    <div className="flex flex-col gap-4 w-full min-w-0">
                                        {/* Code Box */}
                                        <div>
                                            <label className="text-sm font-medium text-purple-400 block mb-2">
                                                Code
                                            </label>
                                            <div className="bg-gray-800 p-2 rounded-lg border text-center border-purple-500/30 text-white w-full">
                                                <span className="font-mono tracking-wider text-white text-lg">
                                                    {roomId}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Link Box */}
                                        <div>
                                            <label className="text-sm font-medium text-purple-400 block mb-2">
                                                Link
                                            </label>
                                            <div className="bg-gray-800 p-2 rounded-lg border border-purple-500/30 text-center text-white w-full">
                                                <span className="text-sm text-white break-all">
                                                    {origin
                                                        ? `${origin}/join?room=${roomId}`
                                                        : "Loading..."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Microphone Control (Read-only display) */}
                                <div className="w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-purple-400">
                                            Microphone
                                        </label>
                                        <div className="flex items-center">
                                            <span
                                                className={`inline-flex h-3 w-3 rounded-full mr-2 ${
                                                    roomData?.micFeatureEnabled
                                                        ? "bg-green-500"
                                                        : "bg-red-500"
                                                }`}
                                            ></span>
                                            <span className="text-xs">
                                                {roomData?.micFeatureEnabled
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-center text-gray-400 mt-1 p-2 bg-gray-800 rounded border border-gray-700">
                                        {roomData?.micFeatureEnabled
                                            ? "Users can use their phones as microphones in this session"
                                            : "Phone microphone functionality is currently disabled"}
                                    </div>
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
                            )}{" "}
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
                                    <div className="flex items-center gap-2 ml-1">
                                        <Button
                                            onClick={toggleVolumeSlider}
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/20 rounded-full"
                                            aria-label="Volume"
                                        >
                                            {isMutedCombined ? (
                                                <VolumeX className="h-5 w-5" />
                                            ) : videoVolume > 50 ? (
                                                <Volume2 className="h-5 w-5" />
                                            ) : videoVolume > 0 ? (
                                                <Volume1 className="h-5 w-5" />
                                            ) : (
                                                <Volume className="h-5 w-5" />
                                            )}
                                        </Button>
                                        {showVolumeSlider && (
                                            <div className="ml-2 w-24 bg-black/70 rounded-full px-2 py-1">
                                                <Slider
                                                    value={[videoVolume]}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    onValueChange={
                                                        handleVideoVolumeChange
                                                    }
                                                    className="w-full"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Score button removed - now triggered automatically when song ends */}
                                </div>
                            )}
                            {/* Fullscreen, Sidebar, and Controls Toggle Buttons */}
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                <div
                                    role="status"
                                    aria-label={`${users.length} users in room`}
                                    className="h-10 flex items-center gap-1.5 rounded-full bg-black/30 px-3 text-white"
                                >
                                    <Users
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    <span aria-hidden="true">{users.length}</span>
                                </div>
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
                            {" "}
                            <TabsList className="flex h-auto w-full flex-nowrap gap-1 mb-2">
                                <TabsTrigger className="min-w-0 flex-1 px-2" value="search">
                                    Search
                                </TabsTrigger>
                                <TabsTrigger className="min-w-0 flex-1 px-2" value="queue">
                                    Queue
                                </TabsTrigger>
                                {isAdmin && (
                                    <TabsTrigger className="min-w-0 flex-1 px-2" value="users">
                                        Users
                                    </TabsTrigger>
                                )}
                                {roomData?.scorerEnabled && (
                                    <TabsTrigger className="min-w-0 flex-1 px-2" value="scores">
                                        Scores
                                    </TabsTrigger>
                                )}
                                {!isAdmin && roomData?.micFeatureEnabled && (
                                    <TabsTrigger className="min-w-0 flex-1 px-2" value="mic">
                                        Mic
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
                                            placeholder="Search for songs or paste a YouTube link/ID..."
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
                                            className="bg-purple-600 hover:bg-purple-500 mr-2"
                                            disabled={isSearching}
                                        >
                                            {isSearching ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Search className="h-4 w-4" />
                                            )}
                                        </Button>
                                        {/* Spec 2: Paste Link entry point */}
                                        <Dialog
                                            open={directLinkOpen}
                                            onOpenChange={(open) => {
                                                setDirectLinkOpen(open);
                                                if (!open) {
                                                    setDirectLinkInput("");
                                                    setDirectLinkPreview(null);
                                                }
                                            }}
                                        >
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="border-gray-600 bg-gray-700 hover:bg-gray-600"
                                                    title="Paste YouTube link or video ID"
                                                    aria-label="Paste YouTube link or video ID"
                                                >
                                                    <Link2 className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="bg-gray-800 border-gray-700 text-white sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Paste YouTube link or
                                                        Video ID
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-3">
                                                    <p className="text-xs text-gray-400">
                                                        Paste any YouTube link
                                                        (watch, shorts, youtu.be,
                                                        embed) or an 11-character
                                                        Video ID. This bypasses
                                                        search quota entirely.
                                                    </p>
                                                    <Input
                                                        autoFocus
                                                        placeholder="https://youtu.be/... or dQw4w9WgXcQ"
                                                        value={directLinkInput}
                                                        onChange={(e) =>
                                                            handleDirectLinkInputChange(
                                                                e.target.value
                                                            )
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    "Enter" &&
                                                                directLinkPreview
                                                            ) {
                                                                handleDirectLinkAdd();
                                                            }
                                                        }}
                                                        className="bg-gray-700 border-gray-600"
                                                    />
                                                    {directLinkPreview && (
                                                        <BypassPreviewCard
                                                            preview={
                                                                directLinkPreview
                                                            }
                                                            onAdd={
                                                                handleDirectLinkAdd
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    <ScrollArea
                                        className="flex-1 bg-gray-800/50 rounded-lg"
                                        orientation="vertical"
                                    >
                                        <div className="space-y-3 p-3">
                                            {/* Spec 2: bypass preview card (URL/ID path) */}
                                            {bypassPreview && (
                                                <BypassPreviewCard
                                                    preview={bypassPreview}
                                                    onAdd={async () => {
                                                        // Throttle prevents
                                                        // double-click queue
                                                        // duplicates.
                                                        if (
                                                            !consumeThrottle(
                                                                lastBypassAtRef
                                                            )
                                                        )
                                                            return;
                                                        try {
                                                            await queueFromPreview(
                                                                bypassPreview
                                                            );
                                                            setBypassPreview(
                                                                null
                                                            );
                                                            setSearchQuery("");
                                                            setActiveTab(
                                                                "queue"
                                                            );
                                                        } catch (error) {
                                                            console.error(
                                                                "Error adding direct YouTube link:",
                                                                error
                                                            );
                                                            toast({
                                                                title: "Error",
                                                                description:
                                                                    "Failed to add video to queue",
                                                                variant: "destructive",
                                                            });
                                                        }
                                                    }}
                                                />
                                            )}
                                            <RovingList
                                                items={searchResults}
                                                getKey={(r) => r.id.videoId}
                                                onActivate={(r) =>
                                                    handleAddToQueue(r)
                                                }
                                                className="space-y-3"
                                                renderItem={(result, _idx, {
                                                    itemProps,
                                                    isFocused,
                                                }) => (
                                                <motion.div
                                                    {...itemProps}
                                                    role="button"
                                                    data-testid="search-result"
                                                    initial={{
                                                        opacity: 0,
                                                        y: 10,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    onClick={() =>
                                                        handleAddToQueue(result)
                                                    }
                                                    className={
                                                        "flex items-start bg-gray-700/70 rounded-lg p-3 transition-colors w-full border cursor-pointer " +
                                                        (isFocused
                                                            ? "border-purple-400 bg-gray-700/90 ring-2 ring-purple-400"
                                                            : "border-gray-700 hover:bg-gray-700/90 focus-within:bg-gray-700/90")
                                                    }
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
                                                )}
                                            />

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
                                                <div className="text-center pt-6 text-gray-400">
                                                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p>
                                                        Search for your favorite songs to sing
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
                                    {currentSongCombined && (
                                        <div
                                            className={cn(
                                                "mb-3 rounded-lg border p-3",
                                                scoringSong
                                                    ? "border-amber-400/70 bg-amber-500/10"
                                                    : "border-purple-400/60 bg-purple-500/10"
                                            )}
                                            aria-live="polite"
                                        >
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                                {scoringSong
                                                    ? "Scoring completed song"
                                                    : "Now playing"}
                                            </p>
                                            <p className="mt-1 truncate text-sm font-medium text-white">
                                                {scoringSong?.title ?? currentSongCombined.title}
                                            </p>
                                        </div>
                                    )}
                                    <ScrollArea
                                        orientation="vertical"
                                        className="flex-1 bg-gray-800/50 rounded-lg"
                                    >
                                        {queueCombined.length > 0 ? (
                                            <div className="space-y-3 p-3">
                                                <AnimatePresence>
                                                    <RovingList
                                                        items={queueCombined}
                                                        getKey={(song, index) =>
                                                            `${song.id}-${index}`
                                                        }
                                                        className="space-y-3"
                                                        renderItem={(
                                                            song,
                                                            index,
                                                            {
                                                                itemProps,
                                                                isFocused,
                                                            }
                                                        ) => (
                                                            <motion.div
                                                                {...itemProps}
                                                                role="listitem"
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
                                                                className={
                                                                    "flex items-center bg-gray-700/70 rounded-lg p-2 w-full transition-colors border group " +
                                                                    (isFocused
                                                                        ? "border-purple-400 bg-gray-700/90 ring-2 ring-purple-400"
                                                                        : "border-gray-700 hover:bg-gray-700/90 focus-within:bg-gray-700/90")
                                                                }
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
                                                                                aria-label="Remove song from queue"
                                                                                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20 shrink-0 h-6 w-6 p-0 rounded-full ml-1 transition-all"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    />
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
                                                    {" "}
                                                    {users.map((user) => (
                                                        <div
                                                            key={user.id}
                                                            className="mb-2 flex items-center justify-between rounded-lg bg-gray-800 p-3"
                                                        >
                                                            {" "}
                                                            <span className="text-sm text-white flex items-center">
                                                                {user.name}{" "}
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
                                                                {user.isMicOn &&
                                                                    !user.isAdmin && (
                                                                        <span
                                                                            className={cn(
                                                                                "ml-2 text-xs flex items-center",
                                                                                user.isMutedByAdmin
                                                                                    ? "text-red-400"
                                                                                    : "text-green-400"
                                                                            )}
                                                                        >
                                                                            <span className="mr-1">
                                                                                {user.isMutedByAdmin ? (
                                                                                    <MicOff className="h-3 w-3 inline" />
                                                                                ) : (
                                                                                    <Mic className="h-3 w-3 inline" />
                                                                                )}
                                                                            </span>
                                                                            {user.isMutedByAdmin
                                                                                ? "(Muted)"
                                                                                : "(Mic On)"}
                                                                        </span>
                                                                    )}{" "}
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
                                            )}{" "}
                                        </ScrollArea>
                                    </TabsContent>
                                )}{" "}
                                {/* Microphone Tab for non-admin users */}
                                {!isAdmin && roomData?.micFeatureEnabled && (
                                    <TabsContent
                                        value="mic"
                                        className="flex-1 flex flex-col overflow-hidden"
                                    >
                                        <div className="flex items-center justify-center h-full">
                                            <div className="text-center space-y-8 max-w-md flex flex-col items-center justify-center">
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-semibold text-white">
                                                        Phone Microphone
                                                        <ExperimentalBadge
                                                            experimental={flags.phoneMicExperimental}
                                                            className="ml-2 align-middle"
                                                        />
                                                    </h3>
                                                    <p className="text-gray-400">
                                                        {isMutedByAdmin
                                                            ? "You have been muted by the host"
                                                            : isMicOn
                                                            ? "Your microphone is active"
                                                            : "Tap the button to use your phone as a microphone"}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={handleMicToggle}
                                                    disabled={
                                                        isMutedByAdmin ||
                                                        micPermissionStatus ===
                                                            "denied" ||
                                                        micPermissionStatus ===
                                                            "unsupported"
                                                    }
                                                    className={cn(
                                                        "h-40 w-40 rounded-full flex flex-col items-center justify-center gap-3 transition-all duration-300 mx-auto",
                                                        isMicOn
                                                            ? "bg-green-600 hover:bg-green-700 animate-pulse-slow"
                                                            : isMutedByAdmin
                                                            ? "bg-red-600 cursor-not-allowed opacity-70"
                                                            : "bg-purple-600 hover:bg-purple-700"
                                                    )}
                                                >
                                                    {" "}
                                                    {isMicOn ? (
                                                        <Mic className="h-16 w-16" />
                                                    ) : isMutedByAdmin ? (
                                                        <div className="relative">
                                                            <Mic className="h-16 w-16 opacity-50" />
                                                            <div className="absolute top-1/2 left-0 w-full h-1 bg-white rotate-45 transform -translate-y-1/2"></div>
                                                        </div>
                                                    ) : (
                                                        <Mic className="h-16 w-16" />
                                                    )}
                                                    <span className="text-sm font-medium">
                                                        {isMicOn
                                                            ? "Tap to turn off"
                                                            : isMutedByAdmin
                                                            ? "Muted by host"
                                                            : "Tap to turn on"}
                                                    </span>
                                                </Button>{" "}
                                                <div className="w-full max-w-xs space-y-3 text-left">
                                                    <div className="flex items-center justify-between text-sm text-white">
                                                        <span>Mic volume</span>
                                                        <span>{micVolumeLevel}%</span>
                                                    </div>
                                                    <Slider
                                                        aria-label="Microphone volume"
                                                        value={[micVolumeLevel]}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            setMicVolumeLevel(
                                                                normalizeMicVolumeLevel(
                                                                    value[0] ??
                                                                        DEFAULT_MIC_VOLUME_LEVEL
                                                                )
                                                            )
                                                        }
                                                        onValueCommit={
                                                            saveMicVolumeLevel
                                                        }
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-gray-400">
                                                        Controls how loud your
                                                        mic sounds to the host.
                                                    </p>
                                                </div>
                                                <div className="w-full max-w-xs space-y-3 text-left">
                                                    <div className="flex items-center justify-between text-sm text-white">
                                                        <span>
                                                            Echo
                                                        </span>
                                                        <span>{micEchoLevel}%</span>
                                                    </div>
                                                    <Slider
                                                        aria-label="Echo level"
                                                        value={[micEchoLevel]}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            setMicEchoLevel(
                                                                value[0] ?? 0
                                                            )
                                                        }
                                                        onValueCommit={
                                                            saveMicEchoLevel
                                                        }
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-gray-400">
                                                        The host hears this
                                                        effect. Your mic stays
                                                        direct.
                                                    </p>
                                                </div>
                                                {isMutedByAdmin && (
                                                    <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-white max-w-xs mx-auto mt-4">
                                                        <p>
                                                            You have been muted
                                                            by the host
                                                        </p>
                                                        <p className="text-xs mt-1">
                                                            You cannot use your
                                                            microphone until the
                                                            host unmutes you
                                                        </p>
                                                    </div>
                                                )}
                                                {micPermissionStatus ===
                                                    "denied" && (
                                                    <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-white max-w-xs mx-auto mt-4">
                                                        <p>
                                                            Microphone access is
                                                            blocked
                                                        </p>
                                                        <p className="text-xs mt-1">
                                                            Please enable
                                                            microphone access in
                                                            your browser
                                                            settings
                                                        </p>
                                                    </div>
                                                )}
                                                {micPermissionStatus ===
                                                    "unsupported" && (
                                                    <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm text-white max-w-xs mx-auto mt-4">
                                                        <p>
                                                            Your browser doesn't
                                                            support this feature
                                                        </p>
                                                        <p className="text-xs mt-1">
                                                            Try using a modern
                                                            browser like Chrome
                                                            or Firefox
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TabsContent>
                                )}
                                {/* Scores Tab */}
                                {roomData?.scorerEnabled && (
                                    <TabsContent
                                        value="scores"
                                        className="mt-0 flex-1 flex min-w-0 flex-col overflow-hidden"
                                    >
                                        <div className="flex flex-col mb-2">
                                            <div className="flex items-center mb-1">
                                                <Trophy className="h-5 w-5 text-yellow-400 mr-2" />
                                                <h3 className="text-lg font-medium">
                                                    Karaoke Champions
                                                    <ExperimentalBadge
                                                        experimental={flags.scorerExperimental}
                                                        className="ml-2 align-middle"
                                                    />
                                                </h3>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Top performances ranked by score
                                            </p>
                                        </div>
                                        <ScrollArea
                                            orientation="vertical"
                                            className="min-w-0 flex-1 bg-gray-800/30 rounded-lg p-1"
                                        >
                                            <div className="min-w-0 overflow-hidden px-1">
                                                <HighScores roomId={roomId} />
                                            </div>
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
