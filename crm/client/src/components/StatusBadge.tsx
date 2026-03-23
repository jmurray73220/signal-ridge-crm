import type { InitiativeStatus, InitiativePriority } from '../types';

export function StatusBadge({ status }: { status: InitiativeStatus }) {
  const styles: Record<InitiativeStatus, { bg: string; color: string }> = {
    Active: { bg: '#0f2d0f', color: '#238636' },
    Pipeline: { bg: '#2d1e00', color: '#d29922' },
    OnHold: { bg: '#2d1e00', color: '#9e6a03' },
    Closed: { bg: '#2d0f0f', color: '#da3633' },
  };
  const s = styles[status] || styles.Pipeline;
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {status === 'OnHold' ? 'ON HOLD' : status.toUpperCase()}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: InitiativePriority }) {
  const styles: Record<InitiativePriority, { bg: string; color: string }> = {
    High: { bg: '#2d0f0f', color: '#da3633' },
    Medium: { bg: '#2d1e00', color: '#d29922' },
    Low: { bg: '#0f2020', color: '#34d399' },
  };
  const s = styles[priority];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {priority.toUpperCase()}
    </span>
  );
}
