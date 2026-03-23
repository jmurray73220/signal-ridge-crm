import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { searchApi } from '../api';
import { EntityTypeBadge } from './EntityTypeBadge';
import type { Contact, Entity, Initiative } from '../types';

interface SearchResults {
  contacts: Contact[];
  entities: Entity[];
  initiatives: Initiative[];
}

export function Header() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.global(query);
        setResults(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const hasResults = results && (
    results.contacts.length > 0 ||
    results.entities.length > 0 ||
    results.initiatives.length > 0
  );

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
    setResults(null);
  };

  return (
    <header
      className="flex items-center gap-4 px-6 py-3"
      style={{ borderBottom: '1px solid #30363d', background: '#161b22' }}
    >
      <div className="relative flex-1 max-w-md">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: '#8b949e' }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search… (⌘K)"
          className="w-full pl-9 pr-9 py-2 text-sm rounded border focus:outline-none focus:border-accent transition-colors"
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
            color: '#e6edf3',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#8b949e' }}
          >
            <X size={14} />
          </button>
        )}

        {open && query.length >= 2 && (
          <div
            className="absolute top-full mt-1 left-0 right-0 rounded border z-50 overflow-hidden"
            style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: 400, overflowY: 'auto' }}
          >
            {loading && (
              <div className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>Searching…</div>
            )}
            {!loading && !hasResults && (
              <div className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>No results found</div>
            )}
            {!loading && results && (
              <>
                {results.contacts.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs uppercase tracking-wider" style={{ color: '#8b949e', background: '#161b22' }}>
                      Contacts
                    </div>
                    {results.contacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => goTo(`/contacts/${c.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-bg transition-colors flex items-center gap-3"
                      >
                        <div>
                          <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                            {c.rank && `${c.rank} `}{c.firstName} {c.lastName}
                          </div>
                          {c.title && <div className="text-xs" style={{ color: '#8b949e' }}>{c.title}</div>}
                        </div>
                        {c.entity && (
                          <EntityTypeBadge
                            entityType={c.entity.entityType}
                            chamber={c.entity.chamber}
                            governmentType={c.entity.governmentType}
                            className="ml-auto"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {results.entities.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs uppercase tracking-wider" style={{ color: '#8b949e', background: '#161b22' }}>
                      Organizations
                    </div>
                    {results.entities.map(e => (
                      <button
                        key={e.id}
                        onClick={() => goTo(`/entities/${e.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-bg transition-colors flex items-center gap-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>{e.name}</div>
                        </div>
                        <EntityTypeBadge
                          entityType={e.entityType}
                          chamber={e.chamber}
                          governmentType={e.governmentType}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {results.initiatives.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs uppercase tracking-wider" style={{ color: '#8b949e', background: '#161b22' }}>
                      Initiatives
                    </div>
                    {results.initiatives.map(i => (
                      <button
                        key={i.id}
                        onClick={() => goTo(`/initiatives/${i.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-bg transition-colors"
                      >
                        <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>{i.title}</div>
                        {i.primaryEntity && (
                          <div className="text-xs" style={{ color: '#8b949e' }}>{i.primaryEntity.name}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
