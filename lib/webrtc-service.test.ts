import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRTCManager } from "./webrtc-service";

vi.mock("./firebase", () => ({ rtdb: {} }));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AdminRTCManager mic settings", () => {
    it("keeps user volume and echo preferences across connection removal", () => {
        vi.stubGlobal("document", { getElementById: vi.fn(() => null) });
        const manager = new AdminRTCManager("room");
        const internals = manager as unknown as {
            userEchoLevels: Map<string, number>;
            userMicVolumes: Map<string, number>;
            removeUserConnection: (userId: string) => void;
        };
        internals.userEchoLevels.set("user", 45);
        internals.userMicVolumes.set("user", 0.6);

        internals.removeUserConnection("user");

        expect(internals.userEchoLevels.get("user")).toBe(45);
        expect(internals.userMicVolumes.get("user")).toBe(0.6);
        manager.close();
    });
});
