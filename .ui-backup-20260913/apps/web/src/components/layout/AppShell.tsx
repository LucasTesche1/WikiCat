import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import type { SpaceSummary } from '@wikicat/shared';

export function AppShell({
  children,
  spaces,
}: {
  children: ReactNode;
  spaces?: SpaceSummary[];
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar spaces={spaces} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar spaces={spaces ?? []} />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="min-h-full max-w-7xl mx-auto w-full p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
