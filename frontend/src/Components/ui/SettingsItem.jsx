import React from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './SettingsItem.module.css';

/** One row in a Settings-style list: icon, label + sub-label, and either a
 * chevron (navigates) or a custom control (e.g. the theme selector) on the
 * right. Used across Settings/Help & Support so every list in that part of
 * the app shares one row instead of each page re-inlining the same markup. */
export default function SettingsItem({ icon: Icon, label, sub, onClick, right, badge }) {
  return (
    <div className={styles.item} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={styles.iconBox}>
        <Icon className={styles.icon} />
      </div>
      <div className={styles.labelBlock}>
        <span className={styles.label}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </div>
      {badge > 0 && <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span>}
      {right || (onClick && <ChevronRight className={styles.arrowIcon} />)}
    </div>
  );
}
