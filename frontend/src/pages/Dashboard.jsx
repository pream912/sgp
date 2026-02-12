import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import LeadsModal from '../components/LeadsModal';
import BuyCreditsModal from '../components/BuyCreditsModal';
import DomainConnectModal from '../components/DomainConnectModal';
import PublishModal from '../components/PublishModal';
import { useCredits } from '../context/CreditsContext';
import { Loader } from 'lucide-react';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [isBuyCreditsOpen, setIsBuyCreditsOpen] = useState(false);
  
  // Publish Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishProjectData, setPublishProjectData] = useState(null);

  // Domain Modal State
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [domainModalData, setDomainModalData] = useState({ projectId: null, currentDomain: null });

  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const navigate = useNavigate();
  const { credits, fetchCredits } = useCredits();

  useEffect(() => {
    // Click outside to close dropdown
    const handleClickOutside = (event) => {
        if (activeDropdownId && !event.target.closest('.project-menu')) {
            setActiveDropdownId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  const handleDeleteProject = async (projectId) => {
      if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone and will remove all associated resources.")) {
          return;
      }

      try {
          const token = await auth.currentUser.getIdToken();
          await axios.delete(`/api/projects/${projectId}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          // Optimistic update handled by realtime listener, but we can clear dropdown
          setActiveDropdownId(null);
      } catch (error) {
          console.error("Delete failed:", error);
          alert("Failed to delete project: " + (error.response?.data?.error || error.message));
      }
  };

  useEffect(() => {
    let unsubscribe;

    const setupRealtimeListener = async () => {
      if (auth.currentUser) {
        // Fetch Token for Previews
        try {
            const t = await auth.currentUser.getIdToken();
            setToken(t);
        } catch (e) { console.error("Token fetch failed", e); }

        const q = query(
            collection(db, 'projects'), 
            where('userId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setLoading(false);
        }, (error) => {
            console.error("Realtime error:", error);
            setLoading(false);
        });
      } else {
          setLoading(false);
      }
    };

    setupRealtimeListener();

    return () => unsubscribe && unsubscribe();
  }, []);

  const openLeads = (projectId) => {
    setSelectedProjectId(projectId);
    setIsLeadsModalOpen(true);
  };

  const openDomainModal = (projectId, currentDomain) => {
      setDomainModalData({ projectId, currentDomain });
      setIsDomainModalOpen(true);
  };

  const openPublishModal = (project) => {
      setPublishProjectData(project);
      setIsPublishModalOpen(true);
  };

  const LogViewer = ({ logs, projectId }) => {
      const logsEndRef = useRef(null);

      useEffect(() => {
          logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, [logs]);

      const filteredLogs = (logs || []).slice(-4).map(log => ({
          ...log,
          message: log.message.replace(projectId, '[PROJECT_ID]')
      }));

      return (
          <div className="bg-slate-900 rounded-lg p-3 h-32 overflow-hidden flex flex-col font-mono text-xs">
              <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                  {filteredLogs.map((log, idx) => (
                      <div key={idx} className="text-slate-300">
                          <span className="text-slate-500 mr-2">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]</span>
                          {log.message}
                      </div>
                  ))}
                  {filteredLogs.length === 0 && <span className="text-slate-600 italic">Waiting for logs...</span>}
                  <div ref={logsEndRef} />
              </div>
          </div>
      );
  };

  return (
    <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Your Projects</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage and edit your AI-generated websites.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-grow md:flex-grow-0 md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex gap-3 ml-auto md:ml-0">
              <button 
                onClick={() => setIsBuyCreditsOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all shadow-sm group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:text-orange-500 transition-colors">add_card</span>
                <span className="whitespace-nowrap">Buy Credits</span>
              </button>
              
              <Link 
                to="/builder"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-orange-500/20 hover:shadow-orange-500/30"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span className="whitespace-nowrap">New Project</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            
            {loading ? (
                 <div className="col-span-full text-center py-20 text-slate-500">Loading your projects...</div>
            ) : projects.length === 0 ? (
                 <div className="col-span-full text-center py-10 bg-white dark:bg-[#1e1c2e] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <p className="text-slate-500">No projects yet.</p>
                 </div>
            ) : (
                projects.map((project) => {
                    const isBuilding = project.status === 'starting' || project.status === 'processing';
                    const previewUrl = project.isPublished && project.deployUrl 
                        ? project.deployUrl 
                        : `/sites/${project.projectId}/index.html?token=${token}`;

                    if (isBuilding) {
                        return (
                            <div key={project.id} className="group bg-white dark:bg-[#1e1c2e] rounded-2xl shadow-sm border-2 border-orange-500/50 overflow-hidden flex flex-col relative h-[360px]">
                                <div className="absolute inset-0 bg-orange-50 dark:bg-orange-900/5 flex flex-col items-center justify-center p-6 text-center animate-pulse-slow">
                                    <div className="w-16 h-16 mb-4 relative">
                                        <div className="absolute inset-0 border-4 border-orange-200 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                                        <Loader className="absolute inset-0 m-auto text-orange-600 w-6 h-6 animate-pulse" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Building your site...</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">This usually takes about 2 to 5 minutes.</p>
                                    
                                    <div className="w-full">
                                        <LogViewer logs={project.logs} projectId={project.projectId} />
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                    <div key={project.id} className="group bg-white dark:bg-[#1e1c2e] rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800 flex flex-col h-[360px]">
                        
                        {/* Card Image */}
                        <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                            <div className="absolute top-3 right-3 z-10">
                                {project.isPublished ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 border border-green-200 dark:border-green-500/30 cursor-default">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Live
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 cursor-default">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Draft
                                    </span>
                                )}
                            </div>
                            
                            {/* Actual Site Preview (Iframe) */}
                            <div className="w-full h-full overflow-hidden bg-white relative">
                                {token || project.isPublished ? (
                                    <iframe 
                                        src={previewUrl}
                                        title={`Preview of ${project.query}`}
                                        className="w-[400%] h-[400%] transform origin-top-left scale-[0.25] border-0 pointer-events-none select-none"
                                        tabIndex="-1"
                                        loading="lazy"
                                        scrolling="no"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <Loader className="animate-spin w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px]">
                                <Link to={`/editor/${project.projectId}?mode=preview`} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:text-orange-500">
                                    Preview
                                </Link>
                            </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-5 flex flex-col flex-grow">
                            <div className="flex items-start justify-between mb-2">
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight truncate" title={project.query}>{project.query}</h3>
                                    {project.isPublished && (
                                        <a href={project.customDomain ? `https://${project.customDomain}` : project.deployUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-500 hover:underline mt-1 block truncate max-w-[200px]">
                                            {project.customDomain || (project.deployUrl ? project.deployUrl.replace(/^https?:\/\//, '') : 'View Site')}
                                        </a>
                                    )}
                                </div>
                                <div className="relative project-menu">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownId(activeDropdownId === project.id ? null : project.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-orange-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                    
                                    {activeDropdownId === project.id && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1e1c2e] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden text-left py-1">
                                            {!project.isPublished && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdownId(null);
                                                        openPublishModal(project);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px] text-green-500">rocket_launch</span>
                                                    Publish
                                                </button>
                                            )}
                                            
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDropdownId(null);
                                                    openLeads(project.projectId);
                                                }}
                                                className="w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">contacts</span>
                                                Leads
                                            </button>

                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDropdownId(null);
                                                    openDomainModal(project.projectId, project.customDomain);
                                                }}
                                                className="w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">language</span>
                                                Domain Settings
                                            </button>
                                            
                                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteProject(project.projectId);
                                                }}
                                                className="w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                Delete Project
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    <span>{project.createdAt?.seconds ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                    {/* <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                        1.2k views
                                    </div> */}
                                </div>
                                
                                <div className="flex items-center justify-end gap-2 w-full">
                                    <Link 
                                        to={`/editor/${project.projectId}?mode=section`}
                                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-xl text-sm font-bold transition-all w-full shadow-lg shadow-orange-500/20"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                        Edit Site
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                })
            )}

            {/* Create New Project Card Button */}
            <Link to="/builder" className="group bg-white dark:bg-[#1e1c2e] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-8 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all duration-300 h-full min-h-[360px]">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-3xl text-orange-500">add</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Create New Project</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-[200px]">Use AI to generate a complete website in seconds.</p>
            </Link>

        </div>

      {/* Modals */}
      <LeadsModal 
        isOpen={isLeadsModalOpen} 
        onClose={() => setIsLeadsModalOpen(false)} 
        projectId={selectedProjectId} 
      />
      <BuyCreditsModal 
        isOpen={isBuyCreditsOpen}
        onClose={() => setIsBuyCreditsOpen(false)}
        onSuccess={() => fetchCredits()}
      />
      <DomainConnectModal
        isOpen={isDomainModalOpen}
        onClose={() => setIsDomainModalOpen(false)}
        projectId={domainModalData.projectId}
        currentDomain={domainModalData.currentDomain}
      />
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        projectId={publishProjectData?.projectId}
        project={publishProjectData}
        currentCredits={credits}
        onSuccess={() => {
            // Realtime listener will auto-update the UI (isPublished: true)
            fetchCredits(); // Refresh credits
        }}
      />

    </div>
  );
};

export default Dashboard;
