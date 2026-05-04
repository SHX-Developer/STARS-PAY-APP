import type { ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 12,
        padding: '0 4px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TOKENS.textMute,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{ fontSize: 18, fontWeight: 700, color: TOKENS.text, letterSpacing: -0.2 }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
