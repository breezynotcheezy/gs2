'use client';

import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import UserMenu from './UserMenu';

export default function AuthProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
      {children}
    </SessionProvider>
  );
}
