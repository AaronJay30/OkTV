/**
 * A short list of commonly-sung karaoke songs, used as a fallback for TV
 * browsers without an on-screen keyboard (Spec 3). When the user navigates
 * to the search tab on a TV with no IME, they can pick one of these with
 * the D-pad instead of typing.
 *
 * Curated for broad karaoke appeal. Order is intentional — top entries are
 * the most universally recognized.
 */
export interface CommonKaraokeQuery {
    title: string;
    artist: string;
    /** Optional pre-filled search query string passed to the API. */
    query: string;
    /** YouTube video ID for the most popular karaoke version we know of. */
    videoId: string;
}

export const COMMON_KARAOKE_QUERIES: CommonKaraokeQuery[] = [
    {
        title: "Bohemian Rhapsody",
        artist: "Queen",
        query: "bohemian rhapsody karaoke",
        videoId: "fJ9rUzIMcZQ",
    },
    {
        title: "Don't Stop Believin'",
        artist: "Journey",
        query: "don't stop believin karaoke",
        videoId: "1k8craCGpEI",
    },
    {
        title: "Wonderwall",
        artist: "Oasis",
        query: "wonderwall karaoke",
        videoId: "bxV1s5fr8dE",
    },
    {
        title: "Mr. Brightside",
        artist: "The Killers",
        query: "mr brightside karaoke",
        videoId: "gGdGFtwcnBE",
    },
    {
        title: "Sweet Caroline",
        artist: "Neil Diamond",
        query: "sweet caroline karaoke",
        videoId: "xMGyE3w_eFc",
    },
    {
        title: "I Will Always Love You",
        artist: "Whitney Houston",
        query: "i will always love you karaoke",
        videoId: "Rq-_2JJc3K4",
    },
    {
        title: "Livin' on a Prayer",
        artist: "Bon Jovi",
        query: "livin on a prayer karaoke",
        videoId: "lDK9QqIzhwk",
    },
    {
        title: "Total Eclipse of the Heart",
        artist: "Bonnie Tyler",
        query: "total eclipse of the heart karaoke",
        videoId: "lcOxhH8N3Bo",
    },
    {
        title: "Africa",
        artist: "Toto",
        query: "africa toto karaoke",
        videoId: "FTQbiNvZqaY",
    },
    {
        title: "Yesterday",
        artist: "The Beatles",
        query: "yesterday beatles karaoke",
        videoId: "NrgmdLzGLEI",
    },
];
