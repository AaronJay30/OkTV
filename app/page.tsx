"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Music, Mic, Users, Play } from "lucide-react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [joinRoomCode, setJoinRoomCode] = useState("")
  const [showJoinInput, setShowJoinInput] = useState(false)

  const handleCreateRoom = () => {
    // Generate a random room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    router.push(`/room/${roomCode}?admin=true`)
  }

  const handleJoinRoom = () => {
    if (joinRoomCode.trim()) {
      router.push(`/room/${joinRoomCode}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-black to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-6xl font-bold mb-2 text-white glow">
          OK<span className="text-purple-500">tv</span>
        </h1>
        <p className="text-xl text-gray-300 animate-pulse-slow">Online Karaoke Experience</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="grid grid-cols-1 gap-6">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="relative">
            <Button
              onClick={handleCreateRoom}
              className="w-full h-16 text-lg bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 glow-border"
            >
              <Mic className="mr-2 h-5 w-5" /> Create Room
            </Button>
            <motion.div
              className="absolute -top-2 -right-2 bg-purple-600 text-white rounded-full p-1"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
            >
              <Play className="h-4 w-4" />
            </motion.div>
          </motion.div>

          {!showJoinInput ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
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
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  className="h-12 bg-gray-800 border-purple-500 focus:ring-purple-500"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinRoom}
                  className="bg-purple-600 hover:bg-purple-500"
                  disabled={!joinRoomCode.trim()}
                >
                  Join
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowJoinInput(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                Cancel
              </Button>
            </motion.div>
          )}
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
          <Music className="h-5 w-5 animate-float" style={{ animationDelay: "1.5s" }} />
        </div>
      </motion.div>
    </main>
  )
}
