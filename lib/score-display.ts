export function getScoreSongDetails(songTitle: string): {
    title: string;
    artist: string | null;
} {
    const separatorIndex = songTitle.indexOf(" - ");

    if (separatorIndex === -1) {
        return { title: songTitle, artist: null };
    }

    return {
        title: songTitle.slice(0, separatorIndex),
        artist: songTitle.slice(separatorIndex + 3),
    };
}
