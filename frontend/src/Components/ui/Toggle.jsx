import React from 'react';
import styles from './Toggle.module.css';

/** A simple on/off switch — shared by every Settings-style boolean
 * preference (private account, push notifications, ...) instead of each
 * page hand-rolling its own checkbox styling. */
export default function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
