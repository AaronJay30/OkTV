import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    flags: null as Record<string, unknown> | null,
    get: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    requireAdmin: vi.fn(),
    audit: vi.fn(),
}));

vi.mock("firebase/database", () => ({
    ref: (_database: unknown, path: string) => path,
    get: state.get,
    update: state.update,
    set: state.set,
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: state.requireAdmin }));
vi.mock("@/lib/firebase", () => ({ rtdb: {} }));
vi.mock("@/lib/admin-audit", () => ({ writeAdminAudit: state.audit }));

import { GET, PUT } from "./route";

function request(method: string, body?: string) {
    return new Request("http://localhost/api/admin/flags", {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body,
    });
}

describe("admin feature flags API", () => {
    beforeEach(() => {
        state.flags = null;
        state.get.mockReset().mockImplementation(async () => ({
            val: () => state.flags,
        }));
        state.update.mockReset().mockImplementation(async (_ref, changes) => {
            state.flags = { ...state.flags, ...changes };
        });
        state.set.mockReset().mockImplementation(async (_ref, value) => {
            state.flags = value;
        });
        state.requireAdmin.mockReset().mockReturnValue({ ok: true, csrfOk: true });
        state.audit.mockReset().mockResolvedValue(undefined);
    });

    it("returns experimental defaults for an older stored record", async () => {
        state.flags = {
            phoneMicEnabled: true,
            scorerEnabled: false,
            reactionsEnabled: true,
        };

        const response = await GET(request("GET"));

        expect(await response.json()).toEqual({
            phoneMicEnabled: true,
            scorerEnabled: false,
            reactionsEnabled: true,
            phoneMicExperimental: false,
            scorerExperimental: false,
            reactionsExperimental: false,
        });
    });

    it("does not read flags when admin authorization fails", async () => {
        state.requireAdmin.mockReturnValue({ ok: false, status: 404 });

        const response = await GET(request("GET"));

        expect(response.status).toBe(404);
        expect(state.get).not.toHaveBeenCalled();
    });

    it("preserves experimental values when an older client omits them", async () => {
        state.flags = {
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
            phoneMicExperimental: true,
            scorerExperimental: false,
            reactionsExperimental: true,
            existingMetadata: "keep",
        };

        const response = await PUT(
            request(
                "PUT",
                JSON.stringify({
                    phoneMicEnabled: false,
                    scorerEnabled: true,
                    reactionsEnabled: true,
                })
            )
        );

        expect(response.status).toBe(200);
        expect(state.flags).toEqual({
            phoneMicEnabled: false,
            scorerEnabled: true,
            reactionsEnabled: true,
            phoneMicExperimental: true,
            scorerExperimental: false,
            reactionsExperimental: true,
            existingMetadata: "keep",
        });
    });

    it("persists all six explicit boolean values", async () => {
        const payload = {
            phoneMicEnabled: true,
            scorerEnabled: false,
            reactionsEnabled: true,
            phoneMicExperimental: false,
            scorerExperimental: true,
            reactionsExperimental: true,
        };

        const response = await PUT(request("PUT", JSON.stringify(payload)));

        expect(response.status).toBe(200);
        expect(state.update).toHaveBeenCalledWith("config/flags", payload);
        expect(await response.json()).toEqual(payload);
    });

    it.each([
        ["invalid JSON", "{"],
        ["invalid experimental type", JSON.stringify({
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
            scorerExperimental: "yes",
        })],
        ["unknown key", JSON.stringify({
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
            unrelated: true,
        })],
    ])("rejects %s without changing flags", async (_case, body) => {
        const original = { phoneMicEnabled: true, custom: "keep" };
        state.flags = original;

        const response = await PUT(request("PUT", body));

        expect(response.status).toBe(400);
        expect(state.update).not.toHaveBeenCalled();
        expect(state.set).not.toHaveBeenCalled();
        expect(state.flags).toEqual(original);
    });

    it("does not update flags when admin authorization fails", async () => {
        state.requireAdmin.mockReturnValue({ ok: false, status: 404 });

        const response = await PUT(request("PUT", JSON.stringify({
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
        })));

        expect(response.status).toBe(404);
        expect(state.update).not.toHaveBeenCalled();
        expect(state.set).not.toHaveBeenCalled();
    });
});
