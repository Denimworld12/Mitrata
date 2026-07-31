import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** A password <input> with a show/hide toggle — wraps whatever input
 * className the page already uses so it drops in as a straight
 * replacement for a bare <input type="password">. */
export default function PasswordInput({ className, style, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: 42, boxSizing: 'border-box', width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--mt-ink3)',
          display: 'flex',
        }}
      >
        {visible ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
