// app/room-not-found/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Music, Home, Plus } from "lucide-react";

export default function RoomNotFound() {
    const router = useRouter();

    const goToHome = () => {
        router.push("/");
    };

    const createNewRoom = () => {
        // Generate a random room ID
        const roomId = Math.random().toString(36).substring(2, 8);
        router.push(`/room/${roomId}?admin=true`);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-black to-gray-900 text-white">
            <div className="w-full max-w-md p-8 bg-gray-800/50 rounded-lg border border-gray-700 shadow-lg text-center">
                <Music className="h-16 w-16 mx-auto mb-6 text-purple-500 opacity-70" />

                <h1 className="text-2xl font-bold mb-2">Room Not Found</h1>

                <p className="text-gray-300 mb-8">
                    The karaoke room you're trying to join doesn't exist or has
                    been closed.
                </p>

                <div className="flex flex-col gap-4">
                    <Button
                        onClick={goToHome}
                        className="bg-gray-700 hover:bg-gray-600 w-full flex items-center justify-center"
                    >
                        <Home className="mr-2 h-4 w-4" />
                        Go to Home
                    </Button>

                    <Button
                        onClick={createNewRoom}
                        className="bg-purple-600 hover:bg-purple-500 w-full flex items-center justify-center"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Room
                    </Button>
                </div>
            </div>
        </main>
    );
}
