import { describe, expect, it } from "vitest";
import { getScoreSongDetails, truncateScoreTitle } from "./score-display";

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

describe("truncateScoreTitle", () => {
    it("keeps titles at the character limit intact", () => {
        const title = "x".repeat(38);

        expect(truncateScoreTitle(title)).toBe(title);
    });

    it("adds an ellipsis after 38 characters for longer titles", () => {
        const title =
            "Panaginip (Extended Version) | Karaoke / Instrumental / Lyrics";

        expect(truncateScoreTitle(title)).toBe(`${title.slice(0, 38)}...`);
    });
});
