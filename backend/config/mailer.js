import nodemailer from "nodemailer";
import dns from "dns";

// Gmail SMTP requires a 16-character App Password (Google Account > Security
// > 2-Step Verification > App Passwords), not the account's normal login
// password — Gmail rejects plain-password SMTP login outright.
const transporter = process.env.EMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
        // Render's containers have no IPv6 egress route, but Node's default
        // DNS resolution for smtp.gmail.com can still hand back an AAAA
        // record first — every send then failed with ENETUNREACH before it
        // ever reached Gmail. `family: 4` alone did NOT fix this in practice
        // (confirmed live — kept failing with the same error after adding
        // it): nodemailer's "service" shorthand doesn't reliably thread that
        // option down to the actual socket connect call. A custom `lookup`
        // forces the DNS resolution itself to IPv4, which is what actually
        // controls which address gets dialed.
        family: 4,
        lookup: (hostname, options, callback) => dns.lookup(hostname, { family: 4 }, callback),
    })
    : null;

export const sendMail = async ({ to, subject, html }) => {
    if (!transporter) {
        // Same "disabled until configured" pattern as googleLogin — lets the
        // rest of the app run locally before the App Password is set up.
        // Logging the body here (not just the subject) is what makes OTP
        // flows testable pre-credentials; harmless since this path only
        // runs when email sending is deliberately off.
        console.warn(`EMAIL_APP_PASSWORD not set — skipping email to ${to}: ${subject}\n${html}`);
        return;
    }
    await transporter.sendMail({
        from: `"Mitrata" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};
