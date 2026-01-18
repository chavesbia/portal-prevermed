import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PortalHeader } from './PortalHeader';
import { PortalSidebar } from './PortalSidebar';

interface PortalLayoutProps {
  showSidebar?: boolean;
}

export function PortalLayout({ showSidebar = true }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!showSidebar) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader />
        <main className="animate-fade-in">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PortalHeader
        showMenuButton
        onMenuClick={() => setSidebarOpen(true)}
      />
      
      <div className="flex flex-1 w-full">
        <PortalSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        <main className="flex-1 overflow-auto animate-fade-in">
          <div className="container max-w-7xl py-6 px-4 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
