'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';

type Tab = { label: string; content: ReactNode };

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [i, setI] = useState(0);

  return (
    <div>
      {/* Tabs row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center', // ✅ Center the buttons
          gap: 16,                  // ✅ More space between buttons
          marginBottom: 24,         // ✅ More breathing room below
        }}
      >
        {tabs.map((t, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            style={{
              padding: '16px 36px',  // ✅ Bigger padding
              borderRadius: 999,
              border: '2px solid #F77F00',
              background: i === idx ? '#F77F00' : '#fff',
              color: i === idx ? '#fff' : '#F77F00',
              fontWeight: 800,
              fontSize: '20px',      // ✅ Larger text
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div>{tabs[i].content}</div>
    </div>
  );
}
