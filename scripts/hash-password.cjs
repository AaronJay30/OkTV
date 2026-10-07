#!/usr/bin/env node
// scripts/hash-password.cjs
//
// One-shot script to generate a bcrypt hash for the admin password.
// Reads the password from stdin via readline — NOT from argv — so the
// plaintext never appears in shell history or process listings.
//
// Note: input is visible as you type. This is a deliberate trade-off
// for cross-platform simplicity. Run it locally only, ideally behind
// a window. The plaintext is in terminal scrollback briefly; the only
// persistent artifact is the hash on stdout, which you paste into
// ADMIN_PASSWORD_HASH in .env.local.
//
// Spec 04 §4.1: bcrypt cost 11 (~100ms/verify).

const bcrypt = require("bcryptjs");
const readline = require("readline");

const COST = 11;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}

async function main() {
    const password = await prompt(
        "Enter admin password (visible, min 8 chars): "
    );

    if (!password || password.length < 8) {
        console.error("\nError: password must be at least 8 characters.");
        rl.close();
        process.exit(1);
    }

    if (password.length > 72) {
        // bcrypt truncates at 72 bytes silently. Warn so we don't
        // surprise the user when login fails for a too-long password.
        console.warn(
            "\nWarning: bcrypt truncates at 72 bytes. Your password is " +
                password.length +
                " chars; only the first 72 will be used."
        );
    }

    const hash = bcrypt.hashSync(password, COST);

    console.log("\nBcrypt hash (cost " + COST + "):");
    console.log(hash);
    console.log("\nPaste this as ADMIN_PASSWORD_HASH in .env.local.");
    console.log(
        'Generate the session secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );

    rl.close();
}

main().catch((e) => {
    console.error("Error:", e);
    process.exit(2);
});