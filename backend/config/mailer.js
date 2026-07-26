import nodemailer from "nodemailer";

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
