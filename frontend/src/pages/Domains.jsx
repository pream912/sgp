import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

const Domains = () => {
    const [myDomains, setMyDomains] = useState([]);
    const [loadingDomains, setLoadingDomains] = useState(true);

    useEffect(() => {
        fetchMyDomains();
    }, []);

    const fetchMyDomains = async () => {
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get('/api/domains', { headers: { Authorization: `Bearer ${token}` } });
            setMyDomains(response.data);
        } catch (error) {
            console.error('Failed to fetch domains:', error);
        } finally {
            setLoadingDomains(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl flex flex-col gap-8">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black tracking-tight">My Domains</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">Manage your custom domains and DNS settings.</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-8 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Domain Name</th>
                                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Purchase Date</th>
                                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loadingDomains ? (
                                    <tr><td colSpan="4" className="py-8 text-center text-slate-500">Loading domains...</td></tr>
                                ) : myDomains.length === 0 ? (
                                    <tr><td colSpan="4" className="py-8 text-center text-slate-500">No domains found.</td></tr>
                                ) : (
                                    myDomains.map((d) => (
                                        <tr key={d.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-slate-500">
                                                        <span className="material-symbols-outlined text-[18px]">language</span>
                                                    </div>
                                                    <span className="font-mono text-sm font-medium text-slate-700 dark:text-white">{d.domain}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
                                                    <span className="size-1.5 rounded-full bg-green-500"></span>
                                                    Active
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm text-slate-700 dark:text-slate-400">
                                                    {d.createdAt && new Date(d.createdAt._seconds * 1000).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                                    <span className="material-symbols-outlined text-[16px] mr-2">settings</span>
                                                    DNS Settings
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Domains;