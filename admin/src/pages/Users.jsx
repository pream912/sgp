import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsers = async (searchTerm = '') => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', { params: { search: searchTerm, limit: 100 } });
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(search);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Users</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, phone, name..."
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white w-64 outline-none focus:border-orange-500"
          />
          <button type="submit" className="h-9 px-4 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium text-right">Credits</th>
                <th className="px-4 py-3 font-medium text-right">Sites</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.uid}
                  onClick={() => navigate(`/users/${user.uid}`)}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{user.displayName || 'No name'}</p>
                    <p className="text-xs text-slate-400">{user.uid.slice(0, 12)}...</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {user.email || user.phoneNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">{user.credits}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{user.sitesCount}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Users;
