import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

const LeadsModal = ({ isOpen, onClose, projectId }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
        setLoading(true);
        try {
          const token = await auth.currentUser.getIdToken();
          // Added /api prefix to route through Vite proxy
          const response = await axios.get(`/api/project/${projectId}/leads`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Ensure data is an array
          setLeads(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
          console.error('Error fetching leads:', error);
          setLeads([]);
        } finally {
          setLoading(false);
        }
      };

    if (isOpen && projectId) {
      fetchLeads();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>
        
        {/* Modal Window */}
        <div className="relative z-50 w-full max-w-5xl flex flex-col bg-white dark:bg-[#1A1A24] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800 h-[80vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1A1A24] shrink-0">
                <div>
                    <h2 className="text-[#121117] dark:text-white tracking-tight text-xl font-bold leading-tight flex items-center gap-2">
                        <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                        Lead Submissions
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-4">Manage and export form entries from your website.</p>
                </div>
                <button onClick={onClose} className="group p-2 rounded-full hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors">
                    <span className="material-symbols-outlined text-gray-400 group-hover:text-orange-500 transition-colors">close</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-4 bg-gray-50/50 dark:bg-[#1E1E29] border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
                <div className="w-full sm:max-w-md">
                    <label className="flex w-full items-center h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                        <div className="flex items-center justify-center pl-3 pr-2 text-gray-400">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </div>
                        <input className="w-full h-full bg-transparent border-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 px-0" placeholder="Search by name or email..." />
                    </label>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none items-center justify-center gap-2 h-10 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-orange-500 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-500 transition-colors shadow-sm group">
                        <span className="material-symbols-outlined text-[18px] text-gray-500 group-hover:text-orange-500 dark:text-gray-400 dark:group-hover:text-orange-500 transition-colors">download</span>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#1A1A24]">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                         <span className="material-symbols-outlined animate-spin text-3xl mr-2">progress_activity</span>
                         Loading leads...
                    </div>
                ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                         <span className="material-symbols-outlined text-5xl mb-2 text-gray-300">inbox</span>
                         No leads found for this project yet.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-[#1A1A24] shadow-sm">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Email</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="group hover:bg-orange-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold uppercase">
                                                {(lead.formData.name || lead.formData.Name || 'A')[0]}
                                            </div>
                                            {lead.formData.name || lead.formData.Name || 'Anonymous'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        {lead.formData.email || lead.formData.Email || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {new Date(lead.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {Object.entries(lead.formData)
                                            .filter(([k]) => !['name', 'email', 'Name', 'Email'].includes(k))
                                            .map(([k, v]) => `${k}: ${v}`).join(', ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-[#1E1E29] border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Showing {leads.length} results</span>
                <div className="flex sm:hidden w-full justify-center pt-2">
                    <button onClick={onClose} className="flex w-full items-center justify-center rounded-lg h-10 px-4 bg-white border border-gray-300 text-gray-700 font-bold shadow-sm hover:border-orange-500 hover:text-orange-500 transition-colors">Close Modal</button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LeadsModal;