import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

const Leads = () => {
    const [leads, setLeads] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Initial fetch
        const init = async () => {
            // Wait for auth to be ready if needed, but usually handled by PrivateRoute
            if (auth.currentUser) {
                fetchData();
            } else {
                 // Retry once if auth not ready (edge case)
                 const unsubscribe = auth.onAuthStateChanged(user => {
                     if (user) fetchData();
                 });
                 return () => unsubscribe();
            }
        };
        init();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await auth.currentUser?.getIdToken();
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const [projectsRes, leadsRes] = await Promise.all([
                axios.get('/api/projects', config),
                axios.get('/api/leads', config)
            ]);

            setProjects(projectsRes.data);
            setLeads(leadsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredLeads = leads.filter(lead => {
        const matchesProject = selectedProject === 'all' || lead.projectId === selectedProject;
        
        const query = searchQuery.toLowerCase();
        
        // Flatten formData values for search
        const formValues = lead.formData ? Object.values(lead.formData).join(' ').toLowerCase() : '';
        const matchesSearch = !query || 
            formValues.includes(query) ||
            (lead.projectId && lead.projectId.toLowerCase().includes(query));

        return matchesProject && matchesSearch;
    });

    // Helper to find specific fields in formData (case insensitive)
    const getField = (data, fieldName) => {
        if (!data) return '';
        const key = Object.keys(data).find(k => k.toLowerCase().includes(fieldName.toLowerCase()));
        return key ? data[key] : '';
    };

    const getProjectName = (id) => {
        const p = projects.find(p => p.projectId === id);
        return p ? (p.query || p.projectId) : id; // Use query (Business Name) or ID
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    // Only published projects for the filter? User said "only published projects"
    const publishedProjects = projects.filter(p => p.isPublished);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[#121117] dark:text-white tracking-tight text-xl font-bold leading-tight flex items-center gap-2">
                            <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                            Lead Submissions
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-4">
                            Manage and export form entries from your websites.
                        </p>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                        
                        {/* Search */}
                        <div className="relative w-full sm:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <span className="material-symbols-outlined text-[20px]">search</span>
                            </div>
                            <input 
                                className="w-full pl-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                placeholder="Search by name, email, or content..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Project Filter */}
                        <div className="w-full sm:w-64">
                            <select 
                                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                            >
                                <option value="all">All Published Projects</option>
                                {publishedProjects.map(p => (
                                    <option key={p.projectId} value={p.projectId}>
                                        {p.query || p.projectId}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-orange-500 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-500 transition-colors shadow-sm group">
                            <span className="material-symbols-outlined text-[18px] text-gray-500 group-hover:text-orange-500 dark:text-gray-400 dark:group-hover:text-orange-500 transition-colors">download</span>
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">Email</th>
                                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/6">Project</th>
                                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/6">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/3">Message</th>
                                    <th className="px-6 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                                                <p>Loading leads...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-4xl text-gray-300">inbox</span>
                                                <p>No leads found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLeads.map((lead) => {
                                        const name = getField(lead.formData, 'name') || 'Unknown';
                                        const email = getField(lead.formData, 'email') || '-';
                                        const message = getField(lead.formData, 'message') || JSON.stringify(lead.formData);
                                        const initial = name.charAt(0).toUpperCase();

                                        return (
                                            <tr key={lead.id} className="group hover:bg-orange-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold">
                                                            {initial}
                                                        </div>
                                                        {name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {email}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                                        {getProjectName(lead.projectId)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {formatDate(lead.createdAt)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={message}>
                                                    {message}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-gray-400 hover:text-orange-500 transition-colors">
                                                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Footer / Pagination (Static for now) */}
                    {!loading && filteredLeads.length > 0 && (
                        <div className="bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Showing {filteredLeads.length} results
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leads;
