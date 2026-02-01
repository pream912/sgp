import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import ThemeToggle from './ThemeToggle';
import CreditsDisplay from './CreditsDisplay';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-x-hidden min-h-screen flex flex-col transition-colors duration-200">
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 sticky top-0 z-20">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4 text-[#121117] dark:text-white">
                        <div className="size-8 flex items-center justify-center bg-orange-500 text-white rounded-lg">
                            <span className="material-symbols-outlined text-xl">rocket_launch</span>
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-tight">GenWeb</h2>
                    </div>
                </div>
                <div className="flex flex-1 justify-end gap-6">
                    <div className="flex items-center gap-4">
                        <CreditsDisplay />
                        <ThemeToggle />
                        
                        <button 
                            onClick={handleLogout}
                            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Sign Out"
                        >
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                        
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center bg-orange-100 text-orange-600 font-bold overflow-hidden">
                             {auth.currentUser?.email?.[0]?.toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Sidebar */}
                <aside className="hidden w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
                    <div className="flex flex-col justify-between p-4 h-full">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-1">
                                <Link 
                                    to="/" 
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                        isActive('/') 
                                        ? 'bg-orange-500/10 text-orange-500' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${isActive('/') ? 'fill-current' : 'group-hover:text-orange-500'}`}>home</span>
                                    <p className="text-sm font-medium">Dashboard</p>
                                </Link>
                                <Link 
                                    to="/domains" 
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                        isActive('/domains') 
                                        ? 'bg-orange-500/10 text-orange-500' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${isActive('/domains') ? 'fill-current' : 'group-hover:text-orange-500'}`}>globe</span>
                                    <p className="text-sm font-medium">Domains</p>
                                </Link>
                                <Link 
                                    to="/leads" 
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                        isActive('/leads') 
                                        ? 'bg-orange-500/10 text-orange-500' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${isActive('/leads') ? 'fill-current' : 'group-hover:text-orange-500'}`}>inbox</span>
                                    <p className="text-sm font-medium">Leads</p>
                                </Link>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background-light dark:bg-background-dark">
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
