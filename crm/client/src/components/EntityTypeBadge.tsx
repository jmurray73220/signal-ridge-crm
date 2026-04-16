import type { EntityType, Chamber, GovernmentType } from '../types';

interface Props {
  entityType: EntityType;
  chamber?: Chamber | null;
  governmentType?: GovernmentType | null;
  className?: string;
  showAsHill?: boolean;
}

export function EntityTypeBadge({ entityType, chamber, governmentType, className = '', showAsHill = false }: Props) {
  if (entityType === 'CongressionalOffice') {
    if (showAsHill) {
      return (
        <span
          className={`badge ${className}`}
          style={{ background: '#1e3a5f', color: '#60a5fa' }}
        >
          HILL
        </span>
      );
    }
    if (chamber === 'Senate') {
      return (
        <span
          className={`badge ${className}`}
          style={{ background: '#2d2a1f', color: '#e0c97f' }}
        >
          SENATE
        </span>
      );
    }
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#2d1f2d', color: '#d4a0d4' }}
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

  if (entityType === 'Client') {
    return (
      <span
        className={`badge ${className}`}
        style={{ background: '#1a2e1a', color: '#4ade80' }}
      >
        CLIENT
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
