import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './FaqItem.module.css';

/** One collapsible question/answer row — shared by any FAQ-style list so a
 * page doesn't need to hand-roll its own open/close state per question. */
export default function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.faqItem}>
      <button className={styles.question} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{question}</span>
        <ChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      {open && <p className={styles.answer}>{answer}</p>}
    </div>
  );
}
