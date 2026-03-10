import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const Sites = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = { limit: 100 };
    if (filter) params.status = filter;
    setLoading(true);
    api.get('/projects', { params }).then(r => setProjects(r.data.projects)).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const statusColors = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    starting: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  };

  const totalFailed = projects.filter(p => p.status === 'failed').length;
  const failureRate = projects.length > 0 ? ((totalFailed / projects.length) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sites</h2>
          <p className="text-sm text-slate-500 mt-1">Failure rate: {failureRate}% ({totalFailed} of {projects.length})</p>
        </div>
        <div className="flex gap-2">
          {['', 'completed', 'failed', 'processing'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                filter === f ? 'bg-orange-500 text-white' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Project ID</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Query</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">Published</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId || p.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{p.projectId || p.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.userId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{p.query || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.pages?.length || 1}</td>
                  <td className="px-4 py-3 text-slate-500">{p.isPublished ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No projects</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Sites;
