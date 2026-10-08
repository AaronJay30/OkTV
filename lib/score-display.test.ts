import { describe, expect, it } from "vitest";
import { getScoreSongDetails } from "./score-display";

describe("getScoreSongDetails", () => {
    it("separates the song title from the artist", () => {
        expect(getScoreSongDetails("Song Title - Artist Name")).toEqual({
            title: "Song Title",
            artist: "Artist Name",
        });
    });

    it("keeps a title without an artist intact", () => {
        expect(getScoreSongDetails("Song Title")).toEqual({
            title: "Song Title",
            artist: null,
        });
    });
});
