"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Types
interface User {
  id: string
  name: string
  isAdmin: boolean
}

interface Song {
  id: string
  title: string
  thumbnail: string
  addedBy: string
}

interface RoomContextType {
  roomId: string
  users: User[]
  queue: Song[]
  currentSong: Song | null
  isPlaying: boolean
  addUser: (name: string) => string
  removeUser: (userId: string) => void
  addSong: (song: Song) => void
  removeSong: (songId: string) => void
  setCurrentSong: (song: Song | null) => void
  setIsPlaying: (isPlaying: boolean) => void
  skipSong: () => void
}

// Create context
const RoomContext = createContext<RoomContextType | undefined>(undefined)

// Provider component
export function RoomProvider({
  children,
  roomId,
}: {
  children: ReactNode
  roomId: string
}) {
  const [users, setUsers] = useState<User[]>([])
  const [queue, setQueue] = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // In a real app, we would connect to WebSocket here
  // and sync the room state with other users
  useEffect(() => {
    // Setup WebSocket connection
    // const socket = new WebSocket(...)

    // Cleanup on unmount
    return () => {
      // socket.close()
    }
  }, [roomId])

  // Add user to room
  const addUser = (name: string): string => {
    const userId = Math.random().toString(36).substring(2, 9)
    const newUser: User = {
      id: userId,
      name,
      isAdmin: users.length === 0, // First user is admin
    }

    setUsers((prev) => [...prev, newUser])

    // In a real app, we would broadcast this to other users

    return userId
  }

  // Remove user from room
  const removeUser = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId))

    // In a real app, we would broadcast this to other users
  }

  // Add song to queue
  const addSong = (song: Song) => {
    setQueue((prev) => [...prev, song])

    // If no song is currently playing, play this one
    if (!currentSong) {
      setCurrentSong(song)
      setQueue((prev) => prev.slice(1))
    }

    // In a real app, we would broadcast this to other users
  }

  // Remove song from queue
  const removeSong = (songId: string) => {
    setQueue((prev) => prev.filter((song) => song.id !== songId))

    // In a real app, we would broadcast this to other users
  }

  // Skip to next song
  const skipSong = () => {
    if (queue.length > 0) {
      const nextSong = queue[0]
      setCurrentSong(nextSong)
      setQueue((prev) => prev.slice(1))
      setIsPlaying(true)
    } else {
      setCurrentSong(null)
      setIsPlaying(false)
    }

    // In a real app, we would broadcast this to other users
  }

  return (
    <RoomContext.Provider
      value={{
        roomId,
        users,
        queue,
        currentSong,
        isPlaying,
        addUser,
        removeUser,
        addSong,
        removeSong,
        setCurrentSong,
        setIsPlaying,
        skipSong,
      }}
    >
      {children}
    </RoomContext.Provider>
  )
}

// Hook for using the room context
export function useRoom() {
  const context = useContext(RoomContext)
  if (context === undefined) {
    throw new Error("useRoom must be used within a RoomProvider")
  }
  return context
}
