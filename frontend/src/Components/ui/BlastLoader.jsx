import React from 'react';
import styles from './BlastLoader.module.css';

/** On-brand loading indicator: the starburst mark as a spinning, pulsing
 * gradient ring with a hollow center — used wherever the app previously
 * showed a plain "...loading" text or a generic spinner. */
export default function BlastLoader({ size = 64 }) {
  return (
    <div className={styles.blast} style={{ width: size, height: size }}>
      <div className={styles.ring} />
      <div className={styles.hole} />
    </div>
  );
}
