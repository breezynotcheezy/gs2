'use client';

import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import SignOutButton from './SignOutButton';
import LoginDialogButton from './LoginDialogButton';

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
        {session?.user ? <SignOutButton /> : <LoginDialogButton />}
      </div>
      {children}
    </SessionProvider>
  );
}
