import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "OkTV - Online Karaoke",
    description: "Sing your heart out with friends online",
    generator: "v0.dev",
    manifest: "/manifest.webmanifest",
    themeColor: "#7c3aed",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/OkTV.ico" type="image/x-icon" />
                {/* Spec 3: PWA manifest for installability + Android TV TWA */}
                <link rel="manifest" href="/manifest.webmanifest" />
                <meta name="theme-color" content="#7c3aed" />
                {/* Apple-style mobile-web-app meta — harmless on Android TV */}
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
                {/* Spec 3: register service worker for offline shell */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('SW registration failed:', err);
    });
  });
}
`.trim(),
                    }}
                />
            </body>
        </html>
    );
}
