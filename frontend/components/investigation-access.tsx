"use client";

import { createContext, useContext, type ReactNode } from "react";

type InvestigationAccess = {
  isPublicDemo: boolean;
  canWrite: boolean;
  canCollaborate: boolean;
};

const authenticatedAccess: InvestigationAccess = {
  isPublicDemo: false,
  canWrite: true,
  canCollaborate: true,
};

const publicDemoAccess: InvestigationAccess = {
  isPublicDemo: true,
  canWrite: false,
  canCollaborate: false,
};

const InvestigationAccessContext = createContext(authenticatedAccess);

export function InvestigationAccessProvider({
  publicDemo = false,
  children,
}: {
  publicDemo?: boolean;
  children: ReactNode;
}) {
  return (
    <InvestigationAccessContext.Provider
      value={publicDemo ? publicDemoAccess : authenticatedAccess}
    >
      {children}
    </InvestigationAccessContext.Provider>
  );
}

export function useInvestigationAccess() {
  return useContext(InvestigationAccessContext);
}
