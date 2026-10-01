// app/[adminPath]/page.tsx
//
// Admin landing page. At v0 this is just a placeholder while the rest
// of the dashboard (features/keys/rooms) is built. The login UI is
// rendered by the layout's AdminAuthGate — this page only renders when
// the user is already authenticated.

export const dynamic = "force-dynamic";

export default function AdminHome() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Admin</h1>
                <p className="text-gray-400">
                    Welcome. The full dashboard (features, keys, rooms) lands
                    in the next slices. For now, this page only proves the
                    auth + path gate is working.
                </p>
                <form
                    method="POST"
                    action="/api/admin/logout"
                    className="mt-6"
                >
                    <button
                        type="submit"
                        className="text-sm text-purple-300 underline hover:text-purple-200"
                    >
                        Sign out
                    </button>
                </form>
            </div>
        </main>
    );
}