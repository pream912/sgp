import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/users', label: 'Users', icon: 'group' },
  { path: '/revenue', label: 'Revenue', icon: 'payments' },
  { path: '/tokens', label: 'Token Usage', icon: 'token' },
  { path: '/sites', label: 'Sites', icon: 'web' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
  { path: '/referrals', label: 'Referrals', icon: 'share' },
];

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center bg-orange-500 text-white rounded-lg">
            <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">GenWeb Admin</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">{auth.currentUser?.email}</span>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  isActive(item.path)
                    ? 'bg-orange-500/10 text-orange-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
