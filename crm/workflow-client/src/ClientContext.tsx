import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listClients } from './api';
import { useAuth } from './AuthContext';
import type { WorkflowClient } from './types';

interface ClientContextValue {
  clients: WorkflowClient[];
  selectedClientId: string | null;
  selectedClient: WorkflowClient | null;
  setSelectedClientId: (id: string | null) => void;
  canSwitch: boolean;
}

const ClientContext = createContext<ClientContextValue | null>(null);

const storageKey = (userId: string) => `sr.workflow.selectedClientId.${userId}`;

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canSwitch = user?.workflowRole === 'WorkflowAdmin';

  const { data: clients = [] } = useQuery<WorkflowClient[]>({
    queryKey: ['clients'],
    queryFn: listClients,
    enabled: !!user?.workflowRole,
  });

  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!user || clients.length === 0) return;

    if (!canSwitch) {
      // Non-admin users are locked to their own client
      setSelectedClientIdState(user.workflowClientId || clients[0]?.id || null);
      return;
    }

    const stored = localStorage.getItem(storageKey(user.id));
    const storedValid = stored && clients.some(c => c.id === stored);
    if (storedValid) {
      setSelectedClientIdState(stored);
    } else {
      // Prefer the user's assigned client, else the first one
      const fallback = (user.workflowClientId && clients.find(c => c.id === user.workflowClientId)?.id) || clients[0].id;
      setSelectedClientIdState(fallback);
    }
  }, [user, clients, canSwitch]);

  const setSelectedClientId = (id: string | null) => {
    if (!canSwitch) return;
    setSelectedClientIdState(id);
    if (user && id) localStorage.setItem(storageKey(user.id), id);
  };

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  return (
    <ClientContext.Provider value={{ clients, selectedClientId, selectedClient, setSelectedClientId, canSwitch }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClientContext must be used within ClientProvider');
  return ctx;
}
