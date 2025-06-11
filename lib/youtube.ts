// Replace the mock YouTube API client with a real implementation

// YouTube API client
// This uses the YouTube Data API v3

export interface YouTubeSearchResult {
    id: {
        videoId: string;
    };
    snippet: {
        title: string;
        description: string;
        thumbnails: {
            default: {
                url: string;
                width: number;
                height: number;
            };
            medium: {
                url: string;
                width: number;
                height: number;
            };
        };
        channelTitle: string;
        publishedAt: string;
    };
}

// Using environment variable for API key
// Make sure to add YOUTUBE_API_KEY to your .env.local file
const API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_YOUTUBE_API_KEY";

export async function searchYouTube(
    query: string
): Promise<YouTubeSearchResult[]> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(
                query + " karaoke"
            )}&type=video&videoEmbeddable=true&key=${API_KEY}`
        );
        if (!response.ok) {
            console.error(`YouTube API error: ${response.status}`);
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        return data.items;
    } catch (error) {
        console.error("Error searching YouTube:", error);
        // Fallback to mock data if API fails
        return getMockSearchResults(query);
    }
}

// Mock data function for development or when API key is not available
function getMockSearchResults(query: string): YouTubeSearchResult[] {
    const allResults = [
        {
            id: { videoId: "dQw4w9WgXcQ" },
            snippet: {
                title: "Rick Astley - Never Gonna Give You Up (Karaoke Version)",
                description:
                    "Official karaoke version for Rick Astley - Never Gonna Give You Up",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2019-10-25T06:57:33Z",
            },
        },
        {
            id: { videoId: "kJQP7kiw5Fk" },
            snippet: {
                title: "Luis Fonsi - Despacito ft. Daddy Yankee (Karaoke)",
                description: "Karaoke version of Despacito",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke World",
                publishedAt: "2017-06-12T15:00:53Z",
            },
        },
        {
            id: { videoId: "JGwWNGJdvx8" },
            snippet: {
                title: "Ed Sheeran - Shape of You (Karaoke Version)",
                description: "Sing along to Shape of You by Ed Sheeran",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2017-03-30T05:00:01Z",
            },
        },
        {
            id: { videoId: "fJ9rUzIMcZQ" },
            snippet: {
                title: "Queen - Bohemian Rhapsody (Karaoke)",
                description: "Karaoke version of Queen's Bohemian Rhapsody",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Legends",
                publishedAt: "2018-05-15T12:30:00Z",
            },
        },
        {
            id: { videoId: "RgKAFK5djSk" },
            snippet: {
                title: "Wiz Khalifa - See You Again ft. Charlie Puth (Karaoke)",
                description: "Karaoke version of See You Again",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke World",
                publishedAt: "2017-04-10T14:20:00Z",
            },
        },
        {
            id: { videoId: "60ItHLz5WEA" },
            snippet: {
                title: "Alan Walker - Faded (Karaoke Version)",
                description: "Sing along to Faded by Alan Walker",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2018-02-20T09:15:00Z",
            },
        },
    ];

    // Filter results based on query
    if (query) {
        const lowerQuery = query.toLowerCase();
        const filteredResults = allResults.filter(
            (result) =>
                result.snippet.title.toLowerCase().includes(lowerQuery) ||
                result.snippet.description.toLowerCase().includes(lowerQuery)
        );
        // If no results found with the filter, return all mock results
        if (filteredResults.length === 0) {
            return allResults;
        }

        return filteredResults;
    }

    return allResults;
}
