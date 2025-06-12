"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkRoomExists } from "@/lib/firebase-service";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const ROOM_ID_LENGTH = 6;

// Create a client component that uses searchParams
function JoinRoomContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlRoomCode = searchParams.get("room");
    const [name, setName] = useState("");
    const [roomCode, setRoomCode] = useState(urlRoomCode || "");
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        if (urlRoomCode && urlRoomCode.length !== ROOM_ID_LENGTH) {
            toast({
                title: "Invalid Room ID in URL",
                description: `The Room ID in the link is invalid. It must be ${ROOM_ID_LENGTH} characters long. Please enter a valid Room ID.`,
                variant: "destructive",
            });
            setRoomCode(""); // Clear the invalid room code from the input
        }
    }, [urlRoomCode]);

    const handleJoinRoom = async () => {
        if (name.trim() && roomCode.trim()) {
            if (roomCode.trim().length !== ROOM_ID_LENGTH) {
                toast({
                    title: "Invalid Room ID Length",
                    description: `Room ID must be ${ROOM_ID_LENGTH} characters long.`,
                    variant: "destructive",
                });
                return;
            }
            try {
                setIsJoining(true);

                // Check if room exists
                const roomExists = await checkRoomExists(roomCode.trim());

                if (!roomExists) {
                    toast({
                        title: "Room Not Found",
                        description:
                            "The room you're trying to join doesn't exist",
                        variant: "destructive",
                    });
                    setIsJoining(false);
                    router.push("/room-not-found");
                    return;
                }

                // Store user name in session storage
                if (typeof window !== "undefined") {
                    sessionStorage.setItem("userName", name.trim());
                }

                router.push(`/room/${roomCode.trim()}`);
            } catch (error) {
                console.error("Error joining room:", error);
                toast({
                    title: "Error",
                    description: "Failed to join the room. Please try again.",
                    variant: "destructive",
                });
                setIsJoining(false);
            }
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-black to-gray-900">
            <Toaster />
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8"
            >
                <h1 className="text-4xl font-bold mb-2 text-white glow">
                    Join a Karaoke Room
                </h1>
                <p className="text-gray-300">
                    Enter your details to join the fun
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="w-full max-w-md space-y-6 bg-gray-800/50 p-6 rounded-lg glow-box"
            >
                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-gray-300 mb-1"
                        >
                            Your Name
                        </label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-700 border-gray-600 focus:border-purple-500"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="roomCode"
                            className="block text-sm font-medium text-gray-300 mb-1"
                        >
                            Room Code
                        </label>
                        <Input
                            id="roomCode"
                            type="text"
                            placeholder="Enter room code"
                            value={roomCode}
                            onChange={(e) =>
                                setRoomCode(e.target.value.toUpperCase())
                            }
                            className="bg-gray-700 border-gray-600 focus:border-purple-500"
                            maxLength={6}
                        />
                    </div>

                    <Button
                        onClick={handleJoinRoom}
                        disabled={!name.trim() || !roomCode.trim() || isJoining}
                        className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 mt-2"
                    >
                        {isJoining ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Joining...
                            </>
                        ) : (
                            <>
                                <Users className="mr-2 h-4 w-4" /> Join Room
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="mt-8"
            >
                <Link href="/">
                    <Button
                        variant="ghost"
                        className="text-gray-400 hover:text-gray-300"
                        disabled={isJoining}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </Link>
            </motion.div>
        </main>
    );
}

// Create a fallback component to show while the component is loading
function JoinRoomFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black to-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
    );
}

export default function JoinRoom() {
    return (
        <Suspense fallback={<JoinRoomFallback />}>
            <JoinRoomContent />
        </Suspense>
    );
}
