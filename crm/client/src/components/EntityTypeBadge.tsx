import type { EntityType, Chamber, GovernmentType } from '../types';

interface Props {
  entityType: EntityType;
  chamber?: Chamber | null;
  governmentType?: GovernmentType | null;
  className?: string;
}

export function EntityTypeBadge({ entityType, chamber, governmentType, className = '' }: Props) {
  if (entityType === 'CongressionalOffice') {
    if (chamber === 'Senate') {
      return (
        <span
          className={`badge ${className}`}
          style={{ background: '#1e3a5f', color: '#60a5fa' }}
        >
          SENATE
        </span>
      );
    }
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#3b1f1f', color: '#f87171' }}
      >
        HOUSE
      </span>
    );
  }

  if (entityType === 'GovernmentOrganization') {
    const label = governmentType || 'GOV';
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#0f3030', color: '#34d399' }}
      >
        {label}
      </span>
    );
  }

  if (entityType === 'Company') {
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#2a2a2a', color: '#9ca3af' }}
      >
        COMPANY
      </span>
    );
  }

  if (entityType === 'NGO') {
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#2a1f3b', color: '#c084fc' }}
      >
        NGO
      </span>
    );
  }

  return (
    <span
      className={`badge ${className}`}
      style={{ background: '#1c2333', color: '#8b949e' }}
    >
      {entityType.toUpperCase()}
    </span>
  );
}
