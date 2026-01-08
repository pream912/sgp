import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Mail, Calendar } from 'lucide-react';
import { auth } from '../firebase';

const LeadsModal = ({ isOpen, onClose, projectId }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchLeads();
    }
  }, [isOpen, projectId]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                Leads & Submissions
              </h3>
              <button
                onClick={onClose}
                className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-2 max-h-96 overflow-y-auto">
              {loading ? (
                <p className="text-center text-gray-500">Loading leads...</p>
              ) : leads.length === 0 ? (
                <p className="text-center text-gray-500">No leads found for this project yet.</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {leads.map((lead) => (
                    <li key={lead.id} className="py-4">
                      <div className="flex space-x-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              {lead.formData.name || lead.formData.Name || 'Anonymous'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {lead.formData.email || lead.formData.Email || 'No Email'}
                          </p>
                          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            {Object.entries(lead.formData).map(([key, value]) => (
                                key !== 'name' && key !== 'email' && key !== 'Name' && key !== 'Email' && (
                                    <div key={key}>
                                        <span className="font-semibold">{key}:</span> {value}
                                    </div>
                                )
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 dark:border-none"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadsModal;
