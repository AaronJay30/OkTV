import { useEffect, useState } from "react";
import { getRoomHighScores } from "@/lib/firebase-service";
import {
    getScoreSongDetails,
    truncateScoreTitle,
} from "@/lib/score-display";
import { Score } from "@/types/room";

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
                    {scores.map((score, index) => {
                        const song = getScoreSongDetails(score.songTitle);

                        return (
                            <div
                                key={score.id}
                                className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border p-2.5 transition-colors ${
                                    index === 0
                                        ? "bg-gradient-to-r from-yellow-500/10 to-gray-800/40 border-yellow-500/30"
                                        : index === 1
                                        ? "bg-gray-400/10 border-gray-400/30"
                                        : index === 2
                                        ? "bg-amber-700/10 border-amber-700/30"
                                        : "bg-gray-800/50 border-gray-700/50"
                                }`}
                            >
                                <div
                                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                                        index === 0
                                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                                            : index === 1
                                            ? "bg-gray-400/20 text-gray-300 border-gray-400/50"
                                            : index === 2
                                            ? "bg-amber-700/20 text-amber-600 border-amber-700/50"
                                            : "bg-gray-700 text-gray-400 border-gray-600"
                                    }`}
                                >
                                    {score.score}
                                </div>

                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <div className="flex min-w-0 items-center justify-between gap-2">
                                        <span className="truncate font-semibold text-white">
                                            {score.userName}
                                        </span>
                                        <time className="flex-shrink-0 text-[11px] text-gray-500">
                                            {new Date(
                                                score.timestamp
                                            ).toLocaleDateString()}
                                        </time>
                                    </div>
                                    <div
                                        className="mt-0.5 min-w-0 truncate text-sm text-gray-300 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-purple-400"
                                        title={score.songTitle}
                                        aria-label={score.songTitle}
                                        tabIndex={0}
                                    >
                                        {truncateScoreTitle(song.title)}
                                    </div>
                                    {song.artist && (
                                        <div className="truncate text-xs text-gray-500">
                                            {truncateScoreTitle(song.artist)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
