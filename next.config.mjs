/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    env: {
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    },
    output: "standalone", // Optimized for Docker deployments
};

export default nextConfig;
