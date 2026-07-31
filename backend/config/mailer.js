import nodemailer from "nodemailer";
import dns from "dns/promises";

// Gmail SMTP requires a 16-character App Password (Google Account > Security
// > 2-Step Verification > App Passwords), not the account's normal login
// password — Gmail rejects plain-password SMTP login outright.
const emailConfigured = !!process.env.EMAIL_APP_PASSWORD;

// Render's containers have no IPv6 egress route, but DNS resolution for
// smtp.gmail.com can still hand back an AAAA record, and every send then
// fails with ENETUNREACH before ever reaching Gmail. Neither `family: 4` nor
// a custom `lookup` on the transport options fixed this in practice —
// confirmed live, both still failed with the same error — because
// nodemailer's "service": "gmail" shorthand doesn't reliably thread either
// option down to the actual socket connect call. Resolving the IPv4 address
// ourselves and connecting directly to it is the only thing that reliably
// worked; `tls.servername` keeps certificate validation correct despite
// connecting via a bare IP instead of the hostname.
let transporterPromise = null;
const getTransporter = async () => {
    if (!emailConfigured) return null;
    if (!transporterPromise) {
        transporterPromise = dns.lookup("smtp.gmail.com", { family: 4 }).then(({ address }) =>
            nodemailer.createTransport({
                host: address,
                port: 465,
                secure: true,
                tls: { servername: "smtp.gmail.com" },
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASSWORD,
                },
            })
        );
    }
    return transporterPromise;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendMail = async ({ to, subject, html }) => {
    if (!emailConfigured) {
        // Same "disabled until configured" pattern as googleLogin — lets the
        // rest of the app run locally before the App Password is set up.
        // Logging the body here (not just the subject) is what makes OTP
        // flows testable pre-credentials; harmless since this path only
        // runs when email sending is deliberately off.
        console.warn(`EMAIL_APP_PASSWORD not set — skipping email to ${to}: ${subject}\n${html}`);
        return;
    }

    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const transporter = await getTransporter();
            await transporter.sendMail({
                from: `"Mitrata" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
            });
            return;
        } catch (err) {
            lastError = err;
            // Gmail's SMTP is a pool of IPs behind DNS round-robin — observed
            // live, failures are often specific to whichever IP got resolved
            // that attempt, not a persistent outage. Dropping the cached
            // transporter forces a fresh DNS lookup (likely a different IP)
            // on the next attempt instead of retrying the same bad address.
            transporterPromise = null;
            if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
        }
    }
    throw lastError;
};
