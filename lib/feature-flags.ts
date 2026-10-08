export interface Flags {
    phoneMicEnabled: boolean;
    scorerEnabled: boolean;
    reactionsEnabled: boolean;
    phoneMicExperimental: boolean;
    scorerExperimental: boolean;
    reactionsExperimental: boolean;
}

export const DEFAULT_FLAGS: Flags = {
    phoneMicEnabled: true,
    scorerEnabled: true,
    reactionsEnabled: true,
    phoneMicExperimental: false,
    scorerExperimental: false,
    reactionsExperimental: false,
};

export function normalizeFlags(raw: unknown): Flags {
    if (!raw || typeof raw !== "object") return DEFAULT_FLAGS;
    const value = raw as Record<string, unknown>;
    return {
        phoneMicEnabled:
            typeof value.phoneMicEnabled === "boolean"
                ? value.phoneMicEnabled
                : true,
        scorerEnabled:
            typeof value.scorerEnabled === "boolean"
                ? value.scorerEnabled
                : true,
        reactionsEnabled:
            typeof value.reactionsEnabled === "boolean"
                ? value.reactionsEnabled
                : true,
        phoneMicExperimental:
            typeof value.phoneMicExperimental === "boolean"
                ? value.phoneMicExperimental
                : false,
        scorerExperimental:
            typeof value.scorerExperimental === "boolean"
                ? value.scorerExperimental
                : false,
        reactionsExperimental:
            typeof value.reactionsExperimental === "boolean"
                ? value.reactionsExperimental
                : false,
    };
}

export function shouldSkipCreateRoomModal(flags: Flags): boolean {
    return (
        !flags.phoneMicEnabled &&
        !flags.scorerEnabled &&
        !flags.reactionsEnabled
    );
}
