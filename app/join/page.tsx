"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinRoom() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [roomCode, setRoomCode] = useState("");

    const handleJoinRoom = () => {
        if (name.trim() && roomCode.trim()) {
            // Store user name in session storage
            try {
                if (typeof window !== "undefined") {
                    sessionStorage.setItem("userName", name.trim());
                }
                router.push(`/room/${roomCode.trim()}`);
            } catch (error) {
                console.error("Session storage error:", error);
                // Continue with navigation even if sessionStorage fails
                router.push(`/room/${roomCode.trim()}`);
            }
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-black to-gray-900">
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
                        disabled={!name.trim() || !roomCode.trim()}
                        className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 mt-2"
                    >
                        <Users className="mr-2 h-4 w-4" /> Join Room
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
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </Link>
            </motion.div>
        </main>
    );
}
