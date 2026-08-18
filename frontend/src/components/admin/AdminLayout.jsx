import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const mainContentRef = useRef(null);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    // `admin-shell` scopes the Inter typography rules in index.css to the
    // dashboard only. Sidebar + Topbar stay mounted; routed pages render into
    // <Outlet /> in the main area on the right.
    <div className="admin-shell flex h-screen overflow-hidden bg-brand-bg text-brand-text">
      {/* Sidebar - persistent */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div
        ref={mainContentRef}
        className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
      >
        {/* Topbar - persistent */}
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page Content */}
        <main className="w-full grow px-4 py-4 sm:px-5 sm:py-5">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
