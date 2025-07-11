"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Mic, Users, Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { checkRoomExists, createRoom } from "@/lib/firebase-service";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Home() {
    const router = useRouter();
    const [joinRoomCode, setJoinRoomCode] = useState("");
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [micFeatureEnabled, setMicFeatureEnabled] = useState(false);
    const [scorerEnabled, setScorerEnabled] = useState(false); // New state for scorer feature

    const handleCreateRoomClick = () => {
        setShowCreateDialog(true);
    };

    const handleCreateRoom = async () => {
        try {
            setIsCreating(true);
            // Generate a random room code
            const roomCode = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase(); // Create the room in Firebase with the mic feature setting
            await createRoom(
                roomCode,
                { id: "admin", name: "Admin", isAdmin: true },
                micFeatureEnabled,
                scorerEnabled
            );

            router.push(`/room/${roomCode}?admin=true`);
        } catch (error) {
            console.error("Error creating room:", error);
            toast({
                title: "Error",
                description: "Could not create the room. Please try again.",
                variant: "destructive",
            });
            setIsCreating(false);
            setShowCreateDialog(false);
        }
    };
    const handleJoinRoom = async () => {
        if (joinRoomCode.trim()) {
            try {
                setIsJoining(true);
                // Check if room exists in Firebase
                const roomExists = await checkRoomExists(joinRoomCode);

                if (roomExists) {
                    router.push(`/room/${joinRoomCode}`);
                } else {
                    toast({
                        title: "Room Not Found",
                        description:
                            "The room you're trying to join doesn't exist",
                        variant: "destructive",
                    });
                    setIsJoining(false);
                }
            } catch (error) {
                console.error("Error checking room:", error);
                toast({
                    title: "Error",
                    description: "Could not verify the room. Please try again.",
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
                <h1 className="text-6xl font-bold mb-2 text-white glow">
                    Ok<span className="text-purple-500">TV</span>
                </h1>
                <p className="text-xl text-gray-300 animate-pulse-slow">
                    Online Karaoke Experience
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="w-full max-w-md space-y-6"
            >
                <div className="grid grid-cols-1 gap-6">
                    <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative"
                    >
                        <Button
                            onClick={handleCreateRoomClick}
                            className="w-full h-16 text-lg bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 glow-border"
                        >
                            <Mic className="mr-2 h-5 w-5" /> Create Room
                        </Button>
                        <motion.div
                            className="absolute -top-2 -right-2 bg-purple-600 text-white rounded-full p-1"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{
                                repeat: Number.POSITIVE_INFINITY,
                                duration: 2,
                            }}
                        >
                            <Play className="h-4 w-4" />
                        </motion.div>
                    </motion.div>
                    {!showJoinInput ? (
                        <motion.div
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                onClick={() => setShowJoinInput(true)}
                                variant="outline"
                                className="w-full h-16 text-lg border-purple-500 text-purple-500 hover:bg-purple-500/10"
                            >
                                <Users className="mr-2 h-5 w-5" /> Join Room
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="flex flex-col space-y-2"
                        >
                            <div className="flex space-x-2">
                                <Input
                                    type="text"
                                    placeholder="Enter room code"
                                    value={joinRoomCode}
                                    onChange={(e) =>
                                        setJoinRoomCode(
                                            e.target.value.toUpperCase()
                                        )
                                    }
                                    className="h-12 bg-gray-800 border-purple-500 focus:ring-purple-500"
                                    maxLength={6}
                                />
                                <Button
                                    onClick={handleJoinRoom}
                                    className="bg-purple-600 hover:bg-purple-500"
                                    disabled={!joinRoomCode.trim()}
                                >
                                    {isJoining ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Joining...
                                        </>
                                    ) : (
                                        "Join"
                                    )}
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowJoinInput(false);
                                    setJoinRoomCode("");
                                    setIsJoining(false);
                                }}
                                className="text-gray-400 hover:text-gray-300"
                                disabled={isJoining}
                            >
                                Cancel
                            </Button>
                        </motion.div>
                    )}{" "}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="mt-16 flex items-center justify-center"
            >
                <div className="flex items-center space-x-4 text-gray-400">
                    <Music className="h-5 w-5 animate-float" />
                    <span>Made with ❤️ for karaoke lovers</span>
                    <Music
                        className="h-5 w-5 animate-float"
                        style={{ animationDelay: "1.5s" }}
                    />
                </div>
            </motion.div>

            <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-xs text-gray-500">
                <p>
                    Contact:{" "}
                    <a
                        href="mailto:aaronjaygabato30@gmail.com"
                        className="hover:text-purple-400"
                    >
                        aaronjaygabato30@gmail.com
                    </a>
                    {" | "}
                    <a
                        href="https://www.facebook.com/gabato.aaron30"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-purple-400"
                    >
                        Facebook
                    </a>
                </p>
            </footer>

            {/* Create Room Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="bg-gray-900 border-purple-500 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-center text-purple-500">
                            Create New Room
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 text-center">
                            Configure your karaoke room settings before
                            creating.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                {" "}
                                <Label
                                    htmlFor="micFeature"
                                    className="text-white flex items-center"
                                >
                                    {" "}
                                    Phone as Microphone{" "}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="ml-2 text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full cursor-help">
                                                    BETA
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-gray-800 text-white border-gray-700">
                                                <p>
                                                    This feature is still in
                                                    testing and may not work as
                                                    expected. It may work
                                                    intermittently or not at
                                                    all.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Label>
                                <p className="text-sm text-gray-400">
                                    Allow users to use their phones as
                                    microphones
                                </p>
                            </div>
                            <Switch
                                id="micFeature"
                                checked={micFeatureEnabled}
                                disabled={true}
                                onCheckedChange={setMicFeatureEnabled}
                                className="data-[state=checked]:bg-purple-500"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                {" "}
                                <Label
                                    htmlFor="scorerEnabled"
                                    className="text-white flex items-center"
                                >
                                    {" "}
                                    Karaoke Scorer{" "}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="ml-2 text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full cursor-help">
                                                    BETA
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-gray-800 text-white border-gray-700">
                                                <p>
                                                    This feature is still in
                                                    testing and may not work as
                                                    expected. Scores are
                                                    randomly generated and may
                                                    not reflect actual
                                                    performance.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Label>
                                <p className="text-sm text-gray-400">
                                    Display a random score after each song
                                    performance
                                </p>
                            </div>
                            <Switch
                                id="scorerEnabled"
                                checked={scorerEnabled}
                                onCheckedChange={setScorerEnabled}
                                className="data-[state=checked]:bg-purple-500"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                            className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateRoom}
                            className="bg-purple-600 hover:bg-purple-500"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Room"
                            )}
                        </Button>
                    </DialogFooter>{" "}
                </DialogContent>
            </Dialog>
        </main>
    );
}
