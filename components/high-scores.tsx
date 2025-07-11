import { useEffect, useState } from "react";
import { getRoomHighScores } from "@/lib/firebase-service";
import { Score } from "@/types/room";
import { Trophy, Music, Star } from "lucide-react";

interface HighScoresProps {
    roomId: string;
}

export const HighScores: React.FC<HighScoresProps> = ({ roomId }) => {
    const [scores, setScores] = useState<Score[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScores = async () => {
            try {
                const highScores = await getRoomHighScores(roomId);
                setScores(highScores);
            } catch (error) {
                console.error("Error fetching high scores:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, [roomId]);

    if (loading) {
        return <p>Loading high scores...</p>;
    }

    return (
        <div className="w-full">
            {scores.length === 0 ? (
                <div className="text-center p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-gray-400">No scores recorded yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Be the first to show off your talent!
                    </p>
                </div>
            ) : (
                <div className="space-y-2 w-full">
                    {scores.map((score, index) => (
                        <div
                            key={score.id}
                            className={`flex items-center p-2 rounded-lg border transition-all w-full ${
                                index === 0
                                    ? "bg-yellow-500/10 border-yellow-500/30"
                                    : index === 1
                                    ? "bg-gray-400/10 border-gray-400/30"
                                    : index === 2
                                    ? "bg-amber-700/10 border-amber-700/30"
                                    : "bg-gray-800/50 border-gray-700/50"
                            } ${index < 3 ? "shadow-md" : ""}`}
                        >
                            {/* Score in circle */}
                            <div
                                className={`flex-shrink-0 min-w-[32px] h-8 w-8 rounded-full flex items-center justify-center mr-3 font-bold ${
                                    index === 0
                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                                        : index === 1
                                        ? "bg-gray-400/20 text-gray-300 border border-gray-400/50"
                                        : index === 2
                                        ? "bg-amber-700/20 text-amber-600 border border-amber-700/50"
                                        : "bg-gray-700 text-gray-400"
                                }`}
                            >
                                {score.score}
                            </div>

                            {/* User and song details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center w-full">
                                    <span className="font-semibold text-white truncate">
                                        {score.userName}
                                    </span>
                                </div>
                                {/* Show title and artist on separate lines if title contains " - " */}
                                {score.songTitle.includes(" - ") ? (
                                    <>
                                        <div className="text-sm text-gray-400 truncate">
                                            {score.songTitle.split(" - ")[0]}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {score.songTitle.split(" - ")[1]}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-400 truncate">
                                        {score.songTitle}
                                    </div>
                                )}
                                <div className="text-xs text-gray-500">
                                    {new Date(
                                        score.timestamp
                                    ).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
