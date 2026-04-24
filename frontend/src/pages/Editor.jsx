import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebase';
import PublishModal from '../components/PublishModal';
import BuyCreditsModal from '../components/BuyCreditsModal';

const Editor = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iframeRef = useRef(null);
  
  // Modes: 'preview', 'section', 'text', 'image', 'theme', 'pages'
  const [activeMode, setActiveMode] = useState('preview');
  const activeModeRef = useRef(activeMode);

  // View Mode: 'desktop', 'tablet', 'mobile'
  const [viewMode, setViewMode] = useState('desktop');
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // 'content', 'theme'

  // Selection State
  const [selectedItem, setSelectedItem] = useState(null); // { type, value, sectionId }
  
  // Input State
  const [instruction, setInstruction] = useState(''); // Section instruction
  const [globalInstruction, setGlobalInstruction] = useState(''); // Global page instruction
  const [textValue, setTextValue] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [colors, setColors] = useState({});
  const [sectionsList, setSectionsList] = useState([]);

  // Pages State
  // Format: [{ name: 'Home', path: 'index.html' }, ...]
  const [pages, setPages] = useState([{ name: 'Home', path: 'index.html' }]);
  const [currentPage, setCurrentPage] = useState('index.html');
  const [isPagesDropdownOpen, setIsPagesDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeContent, setIframeContent] = useState('');

  // Project State
  const [credits, setCredits] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // Pages & Navigation State
  const [siteConfig, setSiteConfig] = useState(null);
  const [newPageName, setNewPageName] = useState('');
  const [newPagePrompt, setNewPagePrompt] = useState('');
  const [addingPage, setAddingPage] = useState(false);
  const [addingSubPage, setAddingSubPage] = useState(false);
  const [newSubPageName, setNewSubPageName] = useState('');
  const [newSubPagePrompt, setNewSubPagePrompt] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
      const init = async () => {
          // Initialize mode from URL
          const modeParam = searchParams.get('mode');
          if (modeParam && ['preview', 'section', 'text', 'image', 'theme', 'menu', 'pages'].includes(modeParam)) {
              setActiveMode(modeParam);
          } else {
             // Default behavior if no param
             setActiveMode('section'); 
          }

          try {
              const token = await auth.currentUser?.getIdToken();
              if (!token) return;
              
              // Set cookie for iframe/asset access
              document.cookie = `access_token=${token}; path=/; max-age=3600; SameSite=Strict`;
              
              const headers = { Authorization: `Bearer ${token}` };
              axios.get('/api/credits', { headers }).then(res => setCredits(res.data.credits));
              axios.get('/api/projects', { headers }).then(res => {
                  const p = res.data.find(x => x.projectId === projectId);
                  if (p && p.isPublished) setIsPublished(true);
              });
          } catch (e) { console.error(e); }
      };
      init();
  }, [projectId, searchParams]);

  useEffect(() => {
    activeModeRef.current = activeMode;
    
    // Auto-open sidebar unless in preview
    if (activeMode !== 'preview') {
        setIsSidebarOpen(true);
    } else {
        setIsSidebarOpen(false);
    }

    if (activeMode === 'theme') {
        setActiveTab('theme');
        fetchTheme();
    } else if (activeMode === 'pages') {
        setActiveTab('content');
        fetchSiteConfig();
    } else if (activeMode === 'menu') {
        setActiveTab('content');
        if (!siteConfig) fetchSiteConfig();
    } else if (activeMode !== 'preview') {
        setActiveTab('content');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode]);

  const handleModeChange = (mode) => {
      setActiveMode(mode);
      setSelectedItem(null);
      setTextValue('');
      setImageFile(null);
  };

  const fetchTheme = async () => {
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.get(`/api/project/${projectId}/theme`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setColors(res.data.colors || {});
      } catch (e) { console.error('Failed to fetch theme', e); }
  };

  const fetchSiteConfig = async () => {
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.get(`/api/project/${projectId}/site-config`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setSiteConfig(res.data);
      } catch (e) { console.error('Failed to fetch site config', e); }
  };

  const handleAddPage = async () => {
      if (!newPageName.trim()) return;
      setAddingPage(true);
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.post(`/api/project/${projectId}/pages/add`, {
              pageName: newPageName.trim(),
              pagePrompt: newPagePrompt.trim() || null,
              isSubPage: false
          }, { headers: { Authorization: `Bearer ${token}` } });
          setSiteConfig(res.data.config);
          setNewPageName('');
          setNewPagePrompt('');
          reloadFrame();
      } catch (e) {
          alert(e.response?.data?.error || 'Failed to add page');
      } finally { setAddingPage(false); }
  };

  const handleAddSubPage = async () => {
      if (!newSubPageName.trim()) return;
      setAddingSubPage(true);
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.post(`/api/project/${projectId}/pages/add`, {
              pageName: newSubPageName.trim(),
              pagePrompt: newSubPagePrompt.trim() || null,
              isSubPage: true
          }, { headers: { Authorization: `Bearer ${token}` } });
          setSiteConfig(res.data.config);
          setNewSubPageName('');
          setNewSubPagePrompt('');
          reloadFrame();
      } catch (e) {
          alert(e.response?.data?.error || 'Failed to add page');
      } finally { setAddingSubPage(false); }
  };

  const handleLogoUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setLogoUploading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          const formData = new FormData();
          formData.append('logo', file);
          const res = await axios.post(`/api/project/${projectId}/logo`, formData, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
          });
          setSiteConfig(prev => prev ? { ...prev, logo: res.data.logo } : prev);
          reloadFrame();
      } catch (e) {
          alert('Failed to upload logo');
      } finally { setLogoUploading(false); }
  };

  const handleUpdateNavOrder = async (newNav) => {
      try {
          const token = await auth.currentUser.getIdToken();
          const updated = { ...siteConfig, navigation: newNav };
          await axios.put(`/api/project/${projectId}/site-config`, updated, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setSiteConfig(updated);
          reloadFrame();
      } catch (e) { alert('Failed to update navigation'); }
  };

  const scanPagesFromNav = (doc) => {
      if (!doc) return;
      
      // Look for nav links in typical locations
      const navLinks = doc.querySelectorAll('nav a, header a, [data-section="header"] a');
      const foundPages = [];
      const seenPaths = new Set();
      
      // Always include current page if not found
      if (!seenPaths.has(currentPage)) {
          // If we have a name for it in state, use it, else default
          const existing = pages.find(p => p.path === currentPage);
          foundPages.push(existing || { name: 'Current Page', path: currentPage });
          seenPaths.add(currentPage);
      }

      navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.endsWith('.html') && !href.startsWith('http')) {
              if (!seenPaths.has(href)) {
                  seenPaths.add(href);
                  let name = link.innerText.trim();
                  if (!name) name = href.replace('.html', '').replace(/-/g, ' '); // Fallback
                  // Title case
                  name = name.charAt(0).toUpperCase() + name.slice(1);
                  foundPages.push({ name, path: href });
              }
          }
      });
      
      // Sort: Home/Index first
      foundPages.sort((a, b) => {
          if (a.path === 'index.html') return -1;
          if (b.path === 'index.html') return 1;
          return a.name.localeCompare(b.name);
      });

      if (foundPages.length > 0) {
          setPages(foundPages);
      }
  };

  const handleIframeLoad = () => {
    try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) return;

        // 1. Scan Sections
        const sections = Array.from(iframeDoc.querySelectorAll('[data-section]')).map(el => ({
            id: el.getAttribute('data-section'),
            name: (el.getAttribute('data-section') || 'Section').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }));
        setSectionsList(sections);

        // 2. Scan Pages from Nav
        scanPagesFromNav(iframeDoc);

        let hoveredElement = null;

        const getTarget = (e) => {
            const mode = activeModeRef.current;
            if (mode === 'preview') return null;
            if (mode === 'section') return e.target.closest('[data-section]');
            if (mode === 'text') {
                const el = e.target;
                if (el.childNodes.length > 0 && el.innerText.trim().length > 0) return el;
                return null;
            }
            if (mode === 'image') return e.target.tagName === 'IMG' || window.getComputedStyle(e.target).backgroundImage !== 'none' ? e.target : null;
            return null;
        };

        iframeDoc.addEventListener('mouseover', (e) => {
            if (activeModeRef.current === 'preview') return;
            
            const target = getTarget(e);
            if (target) {
                if (hoveredElement && hoveredElement !== target) {
                    hoveredElement.style.outline = 'none';
                }
                target.style.outline = '2px solid #f97316'; 
                target.style.cursor = 'pointer';
                hoveredElement = target;
                e.stopPropagation();
            } else if (hoveredElement) {
                hoveredElement.style.outline = 'none';
                hoveredElement = null;
            }
        });

        iframeDoc.addEventListener('mouseout', () => {
             if (hoveredElement) {
                 hoveredElement.style.outline = 'none';
                 hoveredElement = null;
             }
        });

        iframeDoc.addEventListener('click', (e) => {
            if (activeModeRef.current === 'preview') {
                const link = e.target.closest('a');
                if (link) {
                    const href = link.getAttribute('href');
                    if (href && href.endsWith('.html')) {
                         setCurrentPage(href);
                         e.preventDefault();
                    }
                }
                return;
            }

            const target = getTarget(e);
            if (target) {
                e.preventDefault();
                e.stopPropagation();
                const mode = activeModeRef.current;
                const section = target.closest('[data-section]');
                const sectionId = section ? section.getAttribute('data-section') : null;

                if (!sectionId && mode !== 'theme') return;

                if (mode === 'section') {
                   setSelectedItem({ type: 'section', sectionId });
                } else if (mode === 'text') {
                   setSelectedItem({ type: 'text', value: target.innerText, sectionId });
                   setTextValue(target.innerText);
                } else if (mode === 'image') {
                   const isBg = target.tagName !== 'IMG';
                   const src = isBg 
                       ? window.getComputedStyle(target).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] 
                       : target.getAttribute('src');
                   
                   setSelectedItem({ type: 'image', value: src, sectionId, isBg });
                }
            }
        });

    } catch (e) { console.error("Iframe access error:", e); }
  };

  // --- Content Loading ---
  useEffect(() => {
    const loadContent = async () => {
        const timestamp = Date.now();
        const pageFile = currentPage; 
        const localUrl = `/sites/${projectId}/${pageFile}?t=${timestamp}`;
        const gcsUrl = `https://storage.googleapis.com/sgp1-sites-hosting/${projectId}/${pageFile}?t=${timestamp}`;
        const gcsBase = `https://storage.googleapis.com/sgp1-sites-hosting/${projectId}/`;
        
        try {
            const token = await auth.currentUser?.getIdToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await fetch(localUrl, { headers });
            if (!res.ok) throw new Error('Local not found');
            const html = await res.text();
            const localBase = `${window.location.origin}/sites/${projectId}/`;
            setIframeContent(html.replace('<head>', `<head><base href="${localBase}">`));
        } catch {
            try {
                const res = await fetch(gcsUrl);
                if (!res.ok) throw new Error('GCS not found');
                const html = await res.text();
                setIframeContent(html.replace('<head>', `<head><base href="${gcsBase}">`));
            } catch (err) { console.error("Failed to load site content", err); }
        }
    };
    loadContent();
  }, [projectId, iframeKey, currentPage]);

  // --- Actions ---
  const reloadFrame = () => {
      setSelectedItem(null);
      setInstruction('');
      setGlobalInstruction('');
      setTextValue('');
      setImageFile(null);
      setIframeKey(k => k + 1);
      auth.currentUser?.getIdToken().then(t => 
        axios.get('/api/credits', { headers: { Authorization: `Bearer ${t}` } })
        .then(r => setCredits(r.data.credits))
      );
  };
  
  const handleRegenerateSection = async () => {
    if (!selectedItem || !instruction) return;
    setLoading(true);
    try {
        const token = await auth.currentUser.getIdToken();
        await axios.post(`/api/project/${projectId}/section`, {
            sectionId: selectedItem.sectionId, instruction
        }, { headers: { Authorization: `Bearer ${token}` } });
        reloadFrame();
    } catch { alert('Failed'); } finally { setLoading(false); }
  };

  const handleRegeneratePage = async () => {
      if (!globalInstruction) return;
      if (!window.confirm('This will rebuild the entire page and costs 100 credits. Continue?')) return;
      
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          await axios.post(`/api/project/${projectId}/regenerate-page`, {
              instruction: globalInstruction
          }, { headers: { Authorization: `Bearer ${token}` } });
          reloadFrame();
      } catch { alert('Failed'); } finally { setLoading(false); }
  };

  const handleSaveText = async () => {
      if (!selectedItem || !textValue) return;
      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        await axios.post(`/api/project/${projectId}/content`, {
            sectionId: selectedItem.sectionId, type: 'text', originalValue: selectedItem.value, newValue: textValue
        }, { headers: { Authorization: `Bearer ${token}` } });
        reloadFrame();
      } catch { alert('Failed'); } finally { setLoading(false); }
  };

  const handleSaveImage = async () => {
      if (!selectedItem || !imageFile) return;
      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await axios.post(`/api/project/${projectId}/upload`, formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        await axios.post(`/api/project/${projectId}/content`, {
            sectionId: selectedItem.sectionId, type: 'image', originalValue: selectedItem.value, newValue: uploadRes.data.url
        }, { headers: { Authorization: `Bearer ${token}` } });
        reloadFrame();
      } catch { alert('Failed'); } finally { setLoading(false); }
  };

  const handleUndo = async () => {
      if (!window.confirm('Undo last change?')) return;
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          await axios.post(`/api/project/${projectId}/undo`, {}, { headers: { Authorization: `Bearer ${token}` } });
          reloadFrame();
      } catch { alert('Undo failed'); } finally { setLoading(false); }
  };

  const handleSaveTheme = async () => {
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          await axios.post(`/api/project/${projectId}/theme`, { colors }, { headers: { Authorization: `Bearer ${token}` } });
          reloadFrame();
      } catch { alert('Theme update failed'); } finally { setLoading(false); }
  };

  const getImagesInSection = (sectionId) => {
      if (!iframeRef.current) return [];
      const iframeDoc = iframeRef.current.contentDocument;
      const section = iframeDoc.querySelector(`[data-section="${sectionId}"]`);
      if (!section) return [];
      
      const images = [];
      section.querySelectorAll('img').forEach(img => {
          images.push({ type: 'img', src: img.src });
      });
      section.querySelectorAll('*').forEach(el => {
           const bg = iframeDoc.defaultView.getComputedStyle(el).backgroundImage;
           if (bg && bg !== 'none') {
               const match = bg.match(/url\(["']?(.*?)["']?\)/);
               if (match) images.push({ type: 'bg', src: match[1] });
           }
      });
      return Array.from(new Map(images.map(item => [item.src, item])).values());
  };

  // Helper for view mode width
  const getViewModeStyle = () => {
      if (viewMode === 'mobile') return 'w-[375px] h-[667px] shadow-2xl rounded-2xl border-4 border-gray-800 my-8';
      if (viewMode === 'tablet') return 'w-[768px] h-[1024px] shadow-xl rounded-xl border border-gray-200 my-8';
      return 'w-full h-full border-0 rounded-none'; // Desktop
  };

  // Helper for view mode container wrapper
  const getViewWrapperClass = () => {
      if (viewMode === 'desktop') return 'w-full h-full'; // Full space
      return 'w-full h-full flex items-center justify-center py-8 bg-gray-100 dark:bg-black/20'; // Center centered
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#121117] dark:text-white h-screen flex flex-col overflow-hidden font-display">
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#f1f0f4] dark:border-gray-800 bg-white dark:bg-[#1a1924] px-6 py-3 h-16 shrink-0 z-20 relative">
        <div className="flex items-center gap-4 text-[#121117] dark:text-white">
            <button onClick={() => navigate('/')} className="flex items-center justify-center size-8 rounded bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
                <h2 className="text-base font-bold leading-tight">GenWeb Editor</h2>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>{credits} Credits</span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex bg-[#f6f6f8] dark:bg-gray-800 rounded-lg p-1 mr-4">
                 <button 
                    onClick={() => setViewMode('desktop')}
                    title="Desktop View"
                    className={`flex size-8 cursor-pointer items-center justify-center rounded transition-all ${viewMode === 'desktop' ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}
                 >
                    <span className="material-symbols-outlined text-[20px]">desktop_windows</span>
                 </button>
                 <button 
                    onClick={() => setViewMode('tablet')}
                    title="Tablet View"
                    className={`flex size-8 cursor-pointer items-center justify-center rounded transition-all ${viewMode === 'tablet' ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}
                 >
                    <span className="material-symbols-outlined text-[20px]">tablet_mac</span>
                 </button>
                 <button 
                    onClick={() => setViewMode('mobile')}
                    title="Mobile View"
                    className={`flex size-8 cursor-pointer items-center justify-center rounded transition-all ${viewMode === 'mobile' ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}
                 >
                    <span className="material-symbols-outlined text-[20px]">smartphone</span>
                 </button>
            </div>

            <div className="flex bg-[#f6f6f8] dark:bg-gray-800 rounded-lg p-1 mr-4">
                <button onClick={handleUndo} className="flex size-8 cursor-pointer items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm text-gray-600 dark:text-gray-300 transition-all" title="Undo">
                    <span className="material-symbols-outlined text-[20px]">undo</span>
                </button>
                <button onClick={reloadFrame} className="flex size-8 cursor-pointer items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm text-gray-600 dark:text-gray-300 transition-all" title="Refresh">
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                </button>
            </div>
            
        </div>

        <div className="flex gap-3">
            {/* Edit Site Button - Visible only in preview mode */}
            {!isSidebarOpen && (
                 <button 
                    onClick={() => {
                        handleModeChange('menu');
                        setIsSidebarOpen(true);
                    }}
                    className="flex h-9 items-center justify-center rounded-lg px-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-sm font-semibold transition-colors animate-fadeIn"
                >
                    <span className="material-symbols-outlined text-[18px] mr-1">edit</span>
                    Edit Site
                </button>
            )}

            {!isPublished ? (
                <button onClick={() => setShowPublishModal(true)} className="flex h-9 items-center justify-center rounded-lg px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm shadow-orange-500/30">
                    <span className="truncate">Publish</span>
                </button>
            ) : (
                <button className="flex h-9 items-center justify-center rounded-lg px-4 bg-green-500 text-white text-sm font-semibold cursor-default">
                     Published
                </button>
            )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className={`w-[320px] bg-white dark:bg-[#1a1924] border-r border-[#f1f0f4] dark:border-gray-800 flex flex-col shrink-0 z-10 transition-all duration-300 absolute h-full top-0 left-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* Page Selector */}
            <div className="px-4 py-4 border-b border-[#f1f0f4] dark:border-gray-800">
                <div className="relative">
                    <button 
                        onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[#f6f6f8] dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-500 text-[18px]">web</span>
                            Page: {pages.find(p => p.path === currentPage)?.name || currentPage.replace('.html', '')}
                        </div>
                        <span className="material-symbols-outlined text-gray-500 text-[18px]">expand_more</span>
                    </button>
                    
                    {/* Pages Dropdown */}
                    {isPagesDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                            {pages.map((page, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCurrentPage(page.path);
                                        setIsPagesDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${currentPage === page.path ? 'text-orange-500 font-semibold bg-orange-50 dark:bg-orange-900/10' : 'text-gray-700 dark:text-gray-200'}`}
                                >
                                    {page.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                {activeMode === 'menu' ? (
                     <div className="space-y-3 animate-fadeIn">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Editor Tools</h3>
                        
                        <div onClick={() => handleModeChange('section')} className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-500/50 hover:shadow-md cursor-pointer transition-all">
                             <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                 <span className="material-symbols-outlined text-2xl">web_stories</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-900 dark:text-white">Structure & Layout</h4>
                                 <p className="text-xs text-gray-500 mt-1">Reorder sections and AI redesign.</p>
                             </div>
                        </div>

                        <div onClick={() => handleModeChange('text')} className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all">
                             <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                 <span className="material-symbols-outlined text-2xl">edit_note</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-900 dark:text-white">Edit Content</h4>
                                 <p className="text-xs text-gray-500 mt-1">Update text and copy.</p>
                             </div>
                        </div>

                        <div onClick={() => handleModeChange('image')} className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-500/50 hover:shadow-md cursor-pointer transition-all">
                             <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                 <span className="material-symbols-outlined text-2xl">image</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-900 dark:text-white">Images & Media</h4>
                                 <p className="text-xs text-gray-500 mt-1">Replace photos and backgrounds.</p>
                             </div>
                        </div>

                        <div onClick={() => handleModeChange('theme')} className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-500/50 hover:shadow-md cursor-pointer transition-all">
                             <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                 <span className="material-symbols-outlined text-2xl">palette</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-900 dark:text-white">Theme & Styling</h4>
                                 <p className="text-xs text-gray-500 mt-1">Customize brand colors.</p>
                             </div>
                        </div>

                        <div onClick={() => handleModeChange('pages')} className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-500/50 hover:shadow-md cursor-pointer transition-all">
                             <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-500 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                                 <span className="material-symbols-outlined text-2xl">menu</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-900 dark:text-white">Pages & Navigation</h4>
                                 <p className="text-xs text-gray-500 mt-1">Add and manage site pages.</p>
                             </div>
                        </div>

                        {/* Logo Management - inline in menu */}
                        <div className="group p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all">
                             <div className="flex items-start gap-4">
                                 <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                                     <span className="material-symbols-outlined text-2xl">image</span>
                                 </div>
                                 <div className="flex-1">
                                     <h4 className="font-bold text-gray-900 dark:text-white">Site Logo</h4>
                                     <p className="text-xs text-gray-500 mt-1">Upload or change your logo.</p>
                                 </div>
                             </div>
                             <div className="mt-3">
                                 {siteConfig?.logo && (
                                     <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                                         <img src={`/sites/${projectId}/logo.png?t=${Date.now()}`} alt="Current logo" className="max-h-10 object-contain" />
                                     </div>
                                 )}
                                 <label className="w-full py-2 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                     {logoUploading ? (
                                         <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Uploading...</>
                                     ) : (
                                         <><span className="material-symbols-outlined text-[16px]">upload</span> {siteConfig?.logo ? 'Change Logo' : 'Upload Logo'}</>
                                     )}
                                     <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={logoUploading} />
                                 </label>
                             </div>
                        </div>

                        <div onClick={() => handleModeChange('preview')} className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-all mt-6">
                             <div className="p-2 text-gray-500">
                                 <span className="material-symbols-outlined text-2xl">visibility</span>
                             </div>
                             <div>
                                 <h4 className="font-bold text-gray-700 dark:text-gray-300">Preview Site</h4>
                             </div>
                        </div>

                     </div>
                ) : activeTab === 'theme' ? (
                     <div className="space-y-4 animate-fadeIn">
                        <button onClick={() => handleModeChange('menu')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-2">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Tools
                        </button>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Color Theme</h3>
                        <div className="space-y-3">
                            {['primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'].map(key => (
                                <div key={key} className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={colors[key] || '#000000'} onChange={e => setColors({...colors, [key]: e.target.value})} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleSaveTheme} disabled={loading} className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">Apply Theme</button>
                     </div>
                ) : (
                    <>
                        <button onClick={() => handleModeChange('menu')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-2">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Tools
                        </button>
                        
                        {selectedItem ? (
                             <div className="space-y-4 animate-fadeIn">
                                <div className="flex justify-between items-center border-b pb-2 mb-2 dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                                        Edit {selectedItem.type === 'section' ? selectedItem.sectionId : selectedItem.type}
                                    </h3>
                                    <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                </div>
                                
                                {selectedItem.type === 'section' && (
                                    <>
                                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/50">
                                            <label className="text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1 mb-2">
                                                <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                                                AI Redesign (50 Credits)
                                                {credits < 50 && <button onClick={() => setShowBuyCredits(true)} className="ml-auto text-[10px] text-orange-500 hover:text-orange-400 underline font-medium">Buy Credits</button>}
                                            </label>
                                            <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3} className="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm p-2 mb-2" placeholder="e.g. Make it dark themed, add more padding..." />
                                            <button onClick={handleRegenerateSection} disabled={loading || !instruction} className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 text-xs font-bold">Regenerate Section</button>
                                        </div>
                                        
                                        <div className="mt-4">
                                            <p className="text-xs font-semibold text-gray-500 mb-2">Images in this section</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {getImagesInSection(selectedItem.sectionId).map((img, idx) => (
                                                    <div key={idx} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border border-gray-200 dark:border-gray-700 relative group cursor-pointer"
                                                         onClick={() => {
                                                             setActiveMode('image');
                                                             setSelectedItem({ type: 'image', value: img.src, sectionId: selectedItem.sectionId, isBg: img.type === 'bg' });
                                                         }}
                                                    >
                                                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <span className="material-symbols-outlined text-white text-sm">edit</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {getImagesInSection(selectedItem.sectionId).length === 0 && <p className="text-xs text-gray-400 col-span-3">No images found.</p>}
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                {selectedItem.type === 'text' && (
                                    <>
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Text Content</label>
                                        <textarea value={textValue} onChange={e => setTextValue(e.target.value)} rows={6} className="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm p-2" />
                                        <button onClick={handleSaveText} disabled={loading} className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">Save Changes</button>
                                    </>
                                )}
                                
                                {selectedItem.type === 'image' && (
                                    <>
                                        <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-4 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                            {selectedItem.value ? <img src={selectedItem.value} className="max-w-full max-h-full" alt="Preview" /> : <span className="text-xs text-gray-400">No Image</span>}
                                        </div>
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Upload Replacement</label>
                                        <input type="file" onChange={e => setImageFile(e.target.files[0])} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 mb-2" />
                                        <button onClick={handleSaveImage} disabled={loading || !imageFile} className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">Replace Image</button>
                                    </>
                                )}
                             </div>
                        ) : (
                            <>
                                {activeMode === 'section' && (
                                    <>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Select a Section</p>
                                        {sectionsList.map((section, idx) => (
                                            <div key={idx} className="group flex items-center gap-3 bg-white dark:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 p-3 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-black/5 dark:ring-white/10"
                                                onClick={() => {
                                                    const el = iframeRef.current.contentDocument.querySelector(`[data-section="${section.id}"]`);
                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                    setActiveMode('section');
                                                    setSelectedItem({ type: 'section', sectionId: section.id });
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-gray-400 text-[20px]">drag_indicator</span>
                                                <div className="flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-500 shrink-0 size-9">
                                                    <span className="material-symbols-outlined text-[20px]">web_asset</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{section.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {activeMode === 'text' && (
                                    <div className="text-center p-8 text-gray-500">
                                        <span className="material-symbols-outlined text-4xl mb-2">edit_note</span>
                                        <p>Click on any text in the preview to edit its content.</p>
                                    </div>
                                )}
                                {activeMode === 'image' && (
                                    <div className="text-center p-8 text-gray-500">
                                        <span className="material-symbols-outlined text-4xl mb-2">image</span>
                                        <p>Click on any image or background in the preview to replace it.</p>
                                    </div>
                                )}
                                {activeMode === 'pages' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        {!siteConfig ? (
                                            <div className="text-center py-4">
                                                <span className="material-symbols-outlined text-2xl text-gray-300 animate-spin">progress_activity</span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Main Pages */}
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Main Pages</p>
                                                {siteConfig.navigation?.filter(item => item.name !== 'More').map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl ring-1 ring-black/5 dark:ring-white/10">
                                                        <span className="material-symbols-outlined text-teal-400 text-[18px]">web</span>
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{item.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono">{item.path}</span>
                                                    </div>
                                                ))}

                                                {/* Add Main Page */}
                                                {(() => {
                                                    const mainCount = siteConfig.navigation?.filter(item => item.name !== 'More').length || 0;
                                                    return mainCount < 7 ? (
                                                        <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                                                            <input
                                                                value={newPageName}
                                                                onChange={e => setNewPageName(e.target.value)}
                                                                className="w-full px-3 py-2 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-sm"
                                                                placeholder="Page name (e.g. Gallery)"
                                                            />
                                                            <textarea
                                                                value={newPagePrompt}
                                                                onChange={e => setNewPagePrompt(e.target.value)}
                                                                rows={2}
                                                                className="w-full px-3 py-2 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-xs placeholder:text-gray-400 resize-none"
                                                                placeholder="Describe what this page should contain... (optional)"
                                                            />
                                                            <button
                                                                onClick={handleAddPage}
                                                                disabled={addingPage || !newPageName.trim()}
                                                                className="w-full py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-1"
                                                            >
                                                                {addingPage ? (
                                                                    <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating...</>
                                                                ) : (
                                                                    <><span className="material-symbols-outlined text-[16px]">add</span> Add Page</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-amber-500 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                                            Max 7 main pages reached
                                                        </p>
                                                    );
                                                })()}

                                                {/* Sub Pages (under "More" dropdown) */}
                                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                        More Pages
                                                        <span className="normal-case font-normal ml-1">(shown under "More" dropdown)</span>
                                                    </p>

                                                    {(() => {
                                                        const moreItem = siteConfig.navigation?.find(item => item.name === 'More');
                                                        const subPages = moreItem?.children || [];
                                                        return (
                                                            <>
                                                                {subPages.length === 0 && (
                                                                    <p className="text-xs text-gray-400 py-2">No sub-pages yet.</p>
                                                                )}
                                                                {subPages.map((child, cidx) => (
                                                                    <div key={cidx} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl ring-1 ring-black/5 dark:ring-white/10 mb-1">
                                                                        <span className="material-symbols-outlined text-gray-300 text-[16px]">subdirectory_arrow_right</span>
                                                                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{child.name}</span>
                                                                        <span className="text-[10px] text-gray-400 font-mono">{child.path}</span>
                                                                    </div>
                                                                ))}

                                                                {subPages.length < 30 ? (
                                                                    <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl mt-2">
                                                                        <input
                                                                            value={newSubPageName}
                                                                            onChange={e => setNewSubPageName(e.target.value)}
                                                                            className="w-full px-3 py-2 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-sm"
                                                                            placeholder="Sub-page name"
                                                                        />
                                                                        <textarea
                                                                            value={newSubPagePrompt}
                                                                            onChange={e => setNewSubPagePrompt(e.target.value)}
                                                                            rows={2}
                                                                            className="w-full px-3 py-2 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-xs placeholder:text-gray-400 resize-none"
                                                                            placeholder="Describe what this page should contain... (optional)"
                                                                        />
                                                                        <button
                                                                            onClick={handleAddSubPage}
                                                                            disabled={addingSubPage || !newSubPageName.trim()}
                                                                            className="w-full py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-1"
                                                                        >
                                                                            {addingSubPage ? (
                                                                                <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating...</>
                                                                            ) : (
                                                                                <><span className="material-symbols-outlined text-[16px]">add</span> Add Sub Page</>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-2">
                                                                        <span className="material-symbols-outlined text-[14px]">info</span>
                                                                        Max 30 sub-pages reached
                                                                    </p>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>

                                                <p className="text-[10px] text-gray-400 mt-2">Each new page costs 100 credits. {credits < 100 && <button onClick={() => setShowBuyCredits(true)} className="text-orange-500 hover:text-orange-400 underline font-medium">Buy Credits</button>}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Global GenWeb Assistant Input */}
            {activeTab !== 'theme' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-[#f1f0f4] dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-orange-500 text-[18px]">rocket_launch</span>
                        <div className="flex-1">
                            <span className="text-xs font-bold text-gray-900 dark:text-white block">Page Assistant</span>
                            <span className="text-[10px] text-gray-500">Rebuild entire page (100 Credits) {credits < 100 && <button onClick={() => setShowBuyCredits(true)} className="text-orange-500 hover:text-orange-400 underline font-medium">Buy</button>}</span>
                        </div>
                    </div>
                    <div className="relative">
                        <textarea
                            value={globalInstruction}
                            onChange={(e) => setGlobalInstruction(e.target.value)}
                            rows={3}
                            className="w-full pl-3 pr-10 py-2.5 rounded-lg border-0 ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 shadow-sm resize-none"
                            placeholder="Describe page-wide changes..."
                        />
                        <button
                            onClick={handleRegeneratePage}
                            disabled={!globalInstruction || loading}
                            className="absolute right-2 bottom-2 p-1 text-orange-500 hover:bg-orange-500/10 rounded disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                    </div>
                </div>
            )}
        </aside>

        {/* Main Preview Area */}
        <main className={`flex-1 relative bg-background-light dark:bg-[#0f0e15] overflow-auto custom-scrollbar transition-all duration-300 ${isSidebarOpen ? 'ml-[320px]' : 'ml-0'}`}>
            <div className={getViewWrapperClass()}>
                <div className={`${getViewModeStyle()} bg-white text-gray-900 overflow-hidden relative transition-all duration-300`}>
                     <iframe
                        key={iframeKey}
                        ref={iframeRef}
                        srcDoc={iframeContent}
                        className="w-full h-full border-0"
                        title="Site Preview"
                        onLoad={handleIframeLoad}
                    />
                    
                    {loading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-orange-500 animate-spin">progress_activity</span>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-2">Updating...</h3>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
      </div>

      <PublishModal 
        isOpen={showPublishModal} 
        onClose={() => setShowPublishModal(false)} 
        projectId={projectId}
        currentCredits={credits}
        onSuccess={() => {
            setIsPublished(true);
            setCredits(prev => prev - 500); 
            // Refresh
            auth.currentUser?.getIdToken().then(t => 
                axios.get('/api/credits', { headers: { Authorization: `Bearer ${t}` } })
                .then(r => setCredits(r.data.credits))
            );
        }}
      />
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        onSuccess={() => {
            auth.currentUser?.getIdToken().then(t => 
                axios.get('/api/credits', { headers: { Authorization: `Bearer ${t}` } })
                .then(r => setCredits(r.data.credits))
            );
        }}
      />
    </div>
  );
};

export default Editor;
