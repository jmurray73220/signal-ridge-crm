import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Landmark, Building2, Factory, Target, MessageSquare, CheckSquare, Bell, Plus, ChevronRight } from 'lucide-react';
import { contactsApi, entitiesApi, initiativesApi, interactionsApi, tasksApi, remindersApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { PriorityBadge } from '../components/StatusBadge';
import toast from 'react-hot-toast';
import type { Interaction, Reminder, Task } from '../types';

function StatCard({ icon, label, value, to, color }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: string;
  color?: string;
}) {
  return (
    <Link to={to} className="card flex items-center gap-4 hover:border-accent transition-colors" style={{ textDecoration: 'none' }}>
      <div className="p-2.5 rounded-lg" style={{ background: color || '#1e3a1e' }}>
        <span style={{ color: '#e6edf3' }}>{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>{value}</div>
        <div className="text-xs" style={{ color: '#8b949e' }}>{label}</div>
      </div>
    </Link>
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InteractionTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Meeting: '#c9a84c',
    Call: '#60a5fa',
    Email: '#8b949e',
    Hearing: '#f472b6',
    Briefing: '#34d399',
    Event: '#a78bfa',
    Other: '#8b949e',
  };
  return (
    <span className="badge" style={{ background: 'rgba(255,255,255,0.07)', color: colors[type] || '#8b949e' }}>
      {type}
    </span>
  );
}

function isDueSoon(dueDate?: string | null) {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - Date.now();
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function Dashboard() {
  const qc = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  const { data: initiatives = [] } = useQuery({
    queryKey: ['initiatives'],
    queryFn: () => initiativesApi.list().then(r => r.data),
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions'],
    queryFn: () => interactionsApi.list().then(r => r.data),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list({ completed: 'false' }).then(r => r.data),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => remindersApi.list({ completed: 'false' }).then(r => r.data),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => tasksApi.update(id, { completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task completed');
    },
  });

  const senateCount = entities.filter(e => e.entityType === 'CongressionalOffice' && e.chamber === 'Senate').length;
  const houseCount = entities.filter(e => e.entityType === 'CongressionalOffice' && e.chamber === 'House').length;
  const govCount = entities.filter(e => e.entityType === 'GovernmentOrganization').length;
  const companyCount = entities.filter(e => e.entityType === 'Company').length;
  const activeInitiatives = initiatives.filter(i => i.status === 'Active').length;

  const dueSoonTasks = tasks.filter(t => !t.completed && (isDueSoon(t.dueDate) || isOverdue(t.dueDate)));
  const recentInteractions = [...interactions].slice(0, 10);

  const urgentReminders = reminders.filter((r: Reminder) => {
    const d = new Date(r.remindAt);
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return !r.completed && (isOverdue(r.remindAt) || isToday);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>Signal Ridge Strategies — Government Relations Intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/contacts/new" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Contact
          </Link>
          <Link to="/interactions" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Log Interaction
          </Link>
        </div>
      </div>

      {/* Reminder alert strip */}
      {urgentReminders.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 mb-6 flex items-center justify-between"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <Bell size={16} style={{ color: '#c9a84c', flexShrink: 0 }} />
            <div>
              <span className="text-sm font-medium" style={{ color: '#c9a84c' }}>
                {urgentReminders.length} reminder{urgentReminders.length > 1 ? 's' : ''} need{urgentReminders.length === 1 ? 's' : ''} your attention
              </span>
              <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                {urgentReminders.slice(0, 2).map(r => r.title).join(' · ')}
                {urgentReminders.length > 2 ? ` · +${urgentReminders.length - 2} more` : ''}
              </div>
            </div>
          </div>
          <Link
            to="/reminders"
            className="text-xs flex items-center gap-1 flex-shrink-0"
            style={{ color: '#c9a84c', textDecoration: 'none' }}
          >
            View all <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={20} />} label="Total Contacts" value={contacts.length} to="/contacts" color="#1a2a3a" />
        <StatCard icon={<Landmark size={20} />} label="Congressional Offices" value={senateCount + houseCount} to="/congressional" color="#1e3a5f" />
        <StatCard icon={<Building2 size={20} />} label="Government Orgs" value={govCount} to="/government" color="#0f2d1e" />
        <StatCard icon={<Factory size={20} />} label="Companies" value={companyCount} to="/industry" color="#2a2a2a" />
        <StatCard icon={<Target size={20} />} label="Active Initiatives" value={activeInitiatives} to="/initiatives" color="#2d1e00" />
        <StatCard icon={<MessageSquare size={20} />} label="Total Interactions" value={interactions.length} to="/interactions" color="#1e2a3a" />
        <StatCard icon={<CheckSquare size={20} />} label="Open Tasks" value={tasks.length} to="/tasks" color="#1a1a2e" />
        <StatCard icon={<Landmark size={20} />} label="Senate / House" value={`${senateCount} / ${houseCount}`} to="/congressional" color="#1a1a1a" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Interactions */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Recent Interactions</h2>
            <Link to="/interactions" className="text-xs flex items-center gap-1" style={{ color: '#c9a84c', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {recentInteractions.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No interactions logged yet.</p>
              <Link to="/interactions" className="btn-primary inline-block mt-3 text-sm">Log Interaction</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInteractions.map((i: Interaction) => (
                <Link
                  key={i.id}
                  to={`/interactions`}
                  className="flex items-start gap-3 p-3 rounded hover:bg-bg transition-colors"
                  style={{ textDecoration: 'none', border: '1px solid transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <InteractionTypeBadge type={i.type} />
                      <span className="text-xs" style={{ color: '#8b949e' }}>{formatDate(i.date)}</span>
                    </div>
                    <div className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>{i.subject}</div>
                    {i.entity && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <EntityTypeBadge
                          entityType={i.entity.entityType}
                          chamber={i.entity.chamber}
                          governmentType={i.entity.governmentType}
                        />
                        <span className="text-xs truncate" style={{ color: '#8b949e' }}>{i.entity.name}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} style={{ color: '#30363d', flexShrink: 0, marginTop: 2 }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Due */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Tasks Due</h2>
            <Link to="/tasks" className="text-xs flex items-center gap-1" style={{ color: '#c9a84c', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {dueSoonTasks.length === 0 && tasks.length === 0 && (
            <div className="text-center py-10">
              <CheckSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No tasks yet.</p>
              <Link to="/tasks" className="btn-primary inline-block mt-3 text-sm">Add Task</Link>
            </div>
          )}
          {(dueSoonTasks.length > 0 ? dueSoonTasks : tasks.slice(0, 8)).map((t: Task) => {
            const overdue = isOverdue(t.dueDate);
            return (
              <div
                key={t.id}
                className="flex items-start gap-3 py-2.5"
                style={{ borderBottom: '1px solid #30363d' }}
              >
                <button
                  onClick={() => completeTask.mutate(t.id)}
                  className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center hover:border-accent transition-colors"
                  style={{ border: `1px solid ${overdue ? '#da3633' : '#30363d'}` }}
                  title="Mark complete"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: '#e6edf3' }}>{t.title}</div>
                  {t.dueDate && (
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: overdue ? '#da3633' : '#8b949e' }}
                    >
                      {overdue ? 'Overdue — ' : ''}{formatDate(t.dueDate)}
                    </div>
                  )}
                  {t.contact && (
                    <Link
                      to={`/contacts/${t.contact.id}`}
                      className="text-xs"
                      style={{ color: '#c9a84c', textDecoration: 'none' }}
                    >
                      {t.contact.firstName} {t.contact.lastName}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Initiatives */}
      {initiatives.filter(i => i.status === 'Active').length > 0 && (
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Active Initiatives</h2>
            <Link to="/initiatives" className="text-xs flex items-center gap-1" style={{ color: '#c9a84c', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {initiatives.filter(i => i.status === 'Active').map(i => (
              <Link
                key={i.id}
                to={`/initiatives/${i.id}`}
                className="p-3 rounded border hover:border-accent transition-colors"
                style={{ border: '1px solid #30363d', textDecoration: 'none', display: 'block' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>{i.title}</div>
                  <PriorityBadge priority={i.priority} />
                </div>
                {i.primaryEntity && (
                  <div className="flex items-center gap-1.5">
                    <EntityTypeBadge
                      entityType={i.primaryEntity.entityType}
                      chamber={i.primaryEntity.chamber}
                      governmentType={i.primaryEntity.governmentType}
                    />
                    <span className="text-xs truncate" style={{ color: '#8b949e' }}>{i.primaryEntity.name}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
