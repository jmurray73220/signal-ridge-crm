import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag, Users, Building2 } from 'lucide-react';
import { contactsApi, entitiesApi } from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export function Tags() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  // Collect all unique tags across contacts and entities
  const tagStats = useMemo(() => {
    const map = new Map<string, { contacts: any[]; entities: any[] }>();

    for (const c of contacts) {
      for (const tag of (c.tags || [])) {
        if (!map.has(tag)) map.set(tag, { contacts: [], entities: [] });
        map.get(tag)!.contacts.push(c);
      }
    }
    for (const e of entities) {
      for (const tag of (e.tags || [])) {
        if (!map.has(tag)) map.set(tag, { contacts: [], entities: [] });
        map.get(tag)!.entities.push(e);
      }
    }

    return Array.from(map.entries())
      .map(([tag, data]) => ({ tag, ...data, total: data.contacts.length + data.entities.length }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [contacts, entities]);

  const handleCreate = () => {
    const tag = newTag.trim();
    if (!tag) return;
    if (tagStats.some(t => t.tag.toLowerCase() === tag.toLowerCase())) {
      toast.error('Tag already exists');
      return;
    }
    // Tags are created by applying them — just show it in the list
    // We'll add it to a dummy contact tag to persist it, or just inform user
    toast.success(`Tag "${tag}" is ready. Apply it to any contact or entity to start using it.`);
    setNewTag('');
  };

  const handleRename = async (oldTag: string) => {
    const newName = editValue.trim();
    if (!newName || newName === oldTag) {
      setEditingTag(null);
      return;
    }

    // Rename across all contacts and entities
    let updated = 0;
    for (const c of contacts) {
      if ((c.tags || []).includes(oldTag)) {
        const newTags = c.tags.map((t: string) => t === oldTag ? newName : t);
        await contactsApi.update(c.id, { tags: newTags });
        updated++;
      }
    }
    for (const e of entities) {
      if ((e.tags || []).includes(oldTag)) {
        const newTags = e.tags.map((t: string) => t === oldTag ? newName : t);
        await entitiesApi.update(e.id, { tags: newTags });
        updated++;
      }
    }

    toast.success(`Renamed "${oldTag}" → "${newName}" across ${updated} record(s)`);
    setEditingTag(null);
    qc.invalidateQueries({ queryKey: ['contacts'] });
    qc.invalidateQueries({ queryKey: ['entities'] });
  };

  const handleDelete = async (tag: string) => {
    let updated = 0;
    for (const c of contacts) {
      if ((c.tags || []).includes(tag)) {
        const newTags = c.tags.filter((t: string) => t !== tag);
        await contactsApi.update(c.id, { tags: newTags });
        updated++;
      }
    }
    for (const e of entities) {
      if ((e.tags || []).includes(tag)) {
        const newTags = e.tags.filter((t: string) => t !== tag);
        await entitiesApi.update(e.id, { tags: newTags });
        updated++;
      }
    }

    toast.success(`Deleted "${tag}" from ${updated} record(s)`);
    setConfirmDelete(null);
    if (selectedTag === tag) setSelectedTag(null);
    qc.invalidateQueries({ queryKey: ['contacts'] });
    qc.invalidateQueries({ queryKey: ['entities'] });
  };

  const selected = selectedTag ? tagStats.find(t => t.tag === selectedTag) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Tags</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{tagStats.length} tags in use</p>
        </div>
      </div>

      {/* Create new tag */}
      {user?.role !== 'Viewer' && (
        <div className="flex gap-2 mb-4 max-w-md">
          <input
            className="input flex-1"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder="New tag name…"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button onClick={handleCreate} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Add Tag
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Tag list */}
        <div className="card p-0 overflow-hidden">
          {tagStats.length === 0 ? (
            <div className="p-8 text-center">
              <Tag size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No tags yet.</p>
            </div>
          ) : (
            <div>
              {tagStats.map(t => (
                <div
                  key={t.tag}
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid #30363d',
                    background: selectedTag === t.tag ? 'rgba(201,168,76,0.1)' : 'transparent',
                  }}
                  onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {editingTag === t.tag ? (
                      <input
                        className="input text-sm py-0.5"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(t.tag); if (e.key === 'Escape') setEditingTag(null); }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm truncate" style={{ color: selectedTag === t.tag ? '#c9a84c' : '#e6edf3' }}>{t.tag}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs" style={{ color: '#8b949e' }}>{t.total}</span>
                    {user?.role !== 'Viewer' && (
                      <>
                        {editingTag === t.tag ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleRename(t.tag); }}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ color: '#238636', border: '1px solid #238636' }}
                          >Save</button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingTag(t.tag); setEditValue(t.tag); }}
                            style={{ color: '#8b949e' }}
                            title="Rename"
                          ><Pencil size={12} /></button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete(t.tag); }}
                          style={{ color: '#da3633' }}
                          title="Delete"
                        ><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected tag detail */}
        <div className="card p-0 overflow-hidden">
          {selected ? (
            <div>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #30363d' }}>
                <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
                  "{selected.tag}" — {selected.total} record{selected.total !== 1 ? 's' : ''}
                </h2>
              </div>

              {selected.contacts.length > 0 && (
                <>
                  <div className="px-4 py-2" style={{ background: '#161b22' }}>
                    <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#8b949e' }}>
                      <Users size={12} /> Contacts ({selected.contacts.length})
                    </span>
                  </div>
                  {selected.contacts.map((c: any) => (
                    <Link
                      key={c.id}
                      to={`/contacts/${c.id}`}
                      className="flex items-center justify-between px-4 py-2 transition-colors hover:opacity-80"
                      style={{ borderBottom: '1px solid #30363d', color: '#e6edf3', textDecoration: 'none' }}
                    >
                      <span className="text-sm">{c.firstName} {c.lastName}</span>
                      <span className="text-xs" style={{ color: '#8b949e' }}>{c.entity?.name || ''}</span>
                    </Link>
                  ))}
                </>
              )}

              {selected.entities.length > 0 && (
                <>
                  <div className="px-4 py-2" style={{ background: '#161b22' }}>
                    <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#8b949e' }}>
                      <Building2 size={12} /> Organizations ({selected.entities.length})
                    </span>
                  </div>
                  {selected.entities.map((e: any) => (
                    <Link
                      key={e.id}
                      to={`/entities/${e.id}`}
                      className="flex items-center justify-between px-4 py-2 transition-colors hover:opacity-80"
                      style={{ borderBottom: '1px solid #30363d', color: '#e6edf3', textDecoration: 'none' }}
                    >
                      <span className="text-sm">{e.name}</span>
                      <span className="text-xs" style={{ color: '#8b949e' }}>{e.entityType}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Tag size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>Select a tag to see all records using it.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete tag?</h3>
            <p className="text-sm mb-1" style={{ color: '#8b949e' }}>
              Remove "{confirmDelete}" from all records?
            </p>
            {(() => {
              const stat = tagStats.find(t => t.tag === confirmDelete);
              return stat && stat.total > 0 ? (
                <p className="text-sm mb-4" style={{ color: '#da3633' }}>
                  This tag is applied to {stat.total} record{stat.total !== 1 ? 's' : ''}. It will be removed from all of them.
                </p>
              ) : null;
            })()}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
