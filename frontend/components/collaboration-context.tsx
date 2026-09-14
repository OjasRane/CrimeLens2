"use client";

import { createContext, type ReactNode, useContext } from "react";

type CollaborationContextValue = {
  agentId: string;
  isMultiplayer: boolean;
};

const CollaborationContext = createContext<CollaborationContextValue>({
  agentId: "AGENT-01",
  isMultiplayer: false,
});

export function CollaborationProvider({
  agentId,
  isMultiplayer,
  children,
}: CollaborationContextValue & { children: ReactNode }) {
  return (
    <CollaborationContext.Provider value={{ agentId, isMultiplayer }}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaborationIdentity() {
  return useContext(CollaborationContext);
}
