import React from 'react';
import Head from 'next/head';

export default function PrivacyPolicy() {
    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
            <Head>
                <title>Privacy Policy - SocialMedia App</title>
            </Head>
            <h1>Privacy Policy</h1>
            <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>

            <h2>1. Introduction</h2>
            <p>Welcome to SocialMedia App. We are committed to protecting your personal information and your right to privacy.</p>

            <h2>2. Information We Collect</h2>
            <p>We collect personal information that you adhere to provide to us, such as name, address, contact information, passwords and security data, and payment information.</p>

            <h2>3. How We Use Your Information</h2>
            <p>We use personal information collected via our Services for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>

            <h2>4. Sharing Your Information</h2>
            <p>We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.</p>

            <h2>5. Contact Us</h2>
            <p>If you have questions or comments about this policy, you may email us at support@example.com.</p>
        </div>
    );
}
