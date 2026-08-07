import React from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/layout/DashboardLayout';
import FaqItem from '@/Components/ui/FaqItem';
import SettingsItem from '@/Components/ui/SettingsItem';
import styles from './HelpSupport.module.css';
import { ChevronLeft, Mail, ShieldCheck, Trash2 } from 'lucide-react';

export const SUPPORT_EMAIL = 'mitrata.llp@gmail.com';

const FAQS = [
  {
    q: 'How do I reset my password?',
    a: "On the login page, choose \"Forgot password?\", enter your email, and we'll send you a one-time code to set a new password.",
  },
  {
    q: "I didn't get my verification code — what now?",
    a: "Check spam/junk first. If it's genuinely not arriving, wait for the resend cooldown to clear and tap \"Resend code\" on the verification screen.",
  },
  {
    q: 'How do I add or switch between multiple accounts?',
    a: 'Open the account switcher from the sidebar (or the profile menu on mobile) and choose "Add another account" — your other accounts stay signed in so switching back is instant.',
  },
  {
    q: "Someone I don't know can message me — is that expected?",
    a: 'No — messaging only works between accepted connections. If this happens, please report it to us using the contact option below.',
  },
  {
    q: 'How do I permanently delete my account?',
    a: 'Scroll down to "Delete my account" below. It walks you through exactly what gets removed before asking you to confirm — this is deliberately not a one-click action from Settings, since it can\'t be undone.',
  },
];

export default function HelpSupport() {
  const router = useRouter();
  return (
    <DashboardLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => router.push('/settings')}>
            <ChevronLeft className={styles.backIcon} />
            Back
          </button>
          <h1 className={styles.title}>Help & Support</h1>
          <p className={styles.sub}>Answers to common questions, or reach us directly.</p>
        </header>

        <div className={styles.contactCard}>
          <div className={styles.contactIconBox}>
            <Mail size={22} strokeWidth={1.8} />
          </div>
          <div className={styles.contactText}>
            <h3>Email us</h3>
            <p>We typically reply within a day or two.</p>
          </div>
          <a className={styles.emailBtn} href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div className={styles.sectionTitle}>Frequently asked questions</div>
        <div className={`${styles.group} mt-enter`}>
          {FAQS.map((item) => (
            <FaqItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>

        <div className={styles.sectionTitle}>More</div>
        <div className={`${styles.group} mt-enter`}>
          <SettingsItem
            icon={ShieldCheck}
            label="Privacy Policy"
            sub="How we handle your data"
            onClick={() => router.push('/privacy_policy')}
          />
        </div>

        {/* Deliberately down here rather than a quick-access button in
            Settings — see the comment on that page for why. */}
        <div className={styles.sectionTitle}>Account</div>
        <div className={`${styles.group} mt-enter`}>
          <SettingsItem
            icon={Trash2}
            label="Delete my account"
            sub="Permanent and cannot be undone"
            onClick={() => router.push('/help_support/delete_account')}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
