'use client';

type Props = {
  /** either pass (count,total) */
  count?: number;
  total?: number;
  /** or pass (used,limit) */
  used?: number;
  limit?: number;
  className?: string;
};

export function QuotaBadge(props: Props) {
  const used = props.count ?? props.used ?? 0;
  const limit = props.total ?? props.limit ?? 15;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return (
    <div
      className={props.className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: '#FFF7F0',
        border: '1px solid #FCEBD7',
        padding: '6px 10px',
        borderRadius: 999,
        fontWeight: 700,
        color: '#4A2E1C',
        minWidth: 140,
        justifyContent: 'space-between',
      }}
      aria-label={`Quota used ${used} of ${limit}`}
    >
      <span>Today</span>
      <span>{used}/{limit}</span>
      <div
        style={{
          width: 80,
          height: 6,
          background: '#f1dec9',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#F77F00',
          }}
        />
      </div>
    </div>
  );
}

export default QuotaBadge;
