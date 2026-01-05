import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, Palette, Loader, MousePointer, Type, Image as ImageIcon, Undo, Upload, Save, X, Shuffle } from 'lucide-react';
import { auth } from '../firebase';

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  
  // Modes: 'section' (Regenerate), 'text' (Edit Text), 'image' (Replace Image), 'theme' (Edit Colors)
  const [activeMode, setActiveMode] = useState('section'); 
  
  // Selection State
  const [selectedItem, setSelectedItem] = useState(null); // { type, value, sectionId }
  
  // Input State
  const [instruction, setInstruction] = useState(''); // For AI Section regen
  const [textValue, setTextValue] = useState('');     // For Text Edit
  const [imageFile, setImageFile] = useState(null);   // For Image Upload
  const [colors, setColors] = useState({});           // For Theme Edit
  
  const [loading, setLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // To force reload

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      if (!data.type) return;

      if (data.type === 'SECTION_SELECTED' && activeMode === 'section') {
        setSelectedItem({ type: 'section', sectionId: data.sectionId });
      } else if (data.type === 'TEXT_SELECTED' && activeMode === 'text') {
        setSelectedItem({ 
            type: 'text', 
            value: data.value, 
            sectionId: data.sectionId 
        });
        setTextValue(data.value);
      } else if (data.type === 'IMAGE_SELECTED' && activeMode === 'image') {
        setSelectedItem({ 
            type: 'image', 
            value: data.value, 
            sectionId: data.sectionId 
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeMode]);

  // Update Iframe Mode when activeMode changes
  useEffect(() => {
    sendMessageToIframe({ type: 'SET_MODE', mode: activeMode });
    setSelectedItem(null); // Clear selection on mode switch
    setTextValue('');
    setImageFile(null);

    // Fetch theme if entering theme mode
    if (activeMode === 'theme') {
        fetchTheme();
    }
  }, [activeMode]);

  const fetchTheme = async () => {
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.get(`/api/project/${id}/theme`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setColors(res.data.colors || {});
      } catch (e) { console.error('Failed to fetch theme', e); }
  };

  const sendMessageToIframe = (message) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  const handleIframeLoad = () => {
    const scriptContent = `
      let currentMode = 'section';
      let hoveredElement = null;

      window.addEventListener('message', (event) => {
        if (event.data.type === 'SET_MODE') {
          currentMode = event.data.mode;
          // Reset highlights
          if (hoveredElement) {
              hoveredElement.style.outline = 'none';
              hoveredElement = null;
          }
        }
      });

      function getTarget(e) {
          if (currentMode === 'section') return e.target.closest('[data-section]');
          if (currentMode === 'text') {
              // Target leaf text nodes or simple containers
              const el = e.target;
              if (['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LI'].includes(el.tagName)) return el;
              return null;
          }
          if (currentMode === 'image') return e.target.tagName === 'IMG' ? e.target : null;
          return null;
      }

      document.addEventListener('mouseover', (e) => {
        const target = getTarget(e);
        if (target) {
          if (hoveredElement && hoveredElement !== target) {
            hoveredElement.style.outline = 'none';
          }
          target.style.outline = '2px solid #6366f1';
          target.style.cursor = 'pointer';
          hoveredElement = target;
          e.stopPropagation();
        } else if (hoveredElement) {
            hoveredElement.style.outline = 'none';
            hoveredElement = null;
        }
      });

      document.addEventListener('click', (e) => {
        const target = getTarget(e);
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          
          // Find parent section ID for context
          const section = target.closest('[data-section]');
          const sectionId = section ? section.getAttribute('data-section') : null;

          if (currentMode === 'section' && sectionId) {
             window.parent.postMessage({ type: 'SECTION_SELECTED', sectionId }, '*');
          } else if (currentMode === 'text' && sectionId) {
             window.parent.postMessage({ type: 'TEXT_SELECTED', value: target.innerText, sectionId }, '*');
          } else if (currentMode === 'image' && sectionId) {
             window.parent.postMessage({ type: 'IMAGE_SELECTED', value: target.getAttribute('src'), sectionId }, '*');
          }
        }
      });
    `;
    
    try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (iframeDoc) {
            // Check if script already exists to avoid dupes? 
            // Actually, we re-inject on load (after rebuild), so it's fine.
            const script = iframeDoc.createElement('script');
            script.textContent = scriptContent;
            iframeDoc.body.appendChild(script);
            
            // Sync initial mode
            setTimeout(() => sendMessageToIframe({ type: 'SET_MODE', mode: activeMode }), 500);
        }
    } catch (e) {
        console.error("Iframe access error:", e);
    }
  };

  // --- Actions ---

  const handleRegenerateSection = async () => {
    if (!selectedItem || !instruction) return;
    setLoading(true);
    try {
        const token = await auth.currentUser.getIdToken();
        await axios.post(`/api/project/${id}/section`, {
            sectionId: selectedItem.sectionId,
            instruction
        }, { headers: { Authorization: `Bearer ${token}` } });
        reloadFrame();
    } catch (e) { alert('Failed'); console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveText = async () => {
      if (!selectedItem || !textValue) return;
      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        await axios.post(`/api/project/${id}/content`, {
            sectionId: selectedItem.sectionId,
            type: 'text',
            originalValue: selectedItem.value,
            newValue: textValue
        }, { headers: { Authorization: `Bearer ${token}` } });
        reloadFrame();
      } catch (e) { alert('Failed'); console.error(e); }
      finally { setLoading(false); }
  };

  const handleSaveImage = async () => {
      if (!selectedItem || !imageFile) return;
      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        
        // 1. Upload
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await axios.post(`/api/project/${id}/upload`, formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        const newUrl = uploadRes.data.url;

        // 2. Update Content
        await axios.post(`/api/project/${id}/content`, {
            sectionId: selectedItem.sectionId,
            type: 'image',
            originalValue: selectedItem.value,
            newValue: newUrl
        }, { headers: { Authorization: `Bearer ${token}` } });

        reloadFrame();
      } catch (e) { alert('Failed'); console.error(e); }
      finally { setLoading(false); }
  };

  const handleUndo = async () => {
      if (!window.confirm('Undo last change?')) return;
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          await axios.post(`/api/project/${id}/undo`, {}, { 
              headers: { Authorization: `Bearer ${token}` } 
          });
          reloadFrame();
      } catch (e) { alert('Undo failed'); }
      finally { setLoading(false); }
  };

  const handleColorChange = (key, value) => {
      setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveTheme = async () => {
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          await axios.post(`/api/project/${id}/theme`, { colors }, { 
              headers: { Authorization: `Bearer ${token}` } 
          });
          reloadFrame();
      } catch (e) { alert('Theme update failed'); }
      finally { setLoading(false); }
  };

  const handleRegeneratePalette = async () => {
      if (!window.confirm("This will replace current colors. Continue?")) return;
      setLoading(true);
      try {
          const token = await auth.currentUser.getIdToken();
          const res = await axios.post(`/api/project/${id}/theme/regenerate`, {}, {
               headers: { Authorization: `Bearer ${token}` }
          });
          setColors(res.data.colors);
      } catch (e) { alert('Regeneration failed'); }
      finally { setLoading(false); }
  };

  const reloadFrame = () => {
      setSelectedItem(null);
      setInstruction('');
      setTextValue('');
      setImageFile(null);
      setIframeKey(k => k + 1);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center">
            <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mr-4">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Site Editor</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={handleUndo} disabled={loading} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" title="Undo">
                <Undo className="w-5 h-5" />
            </button>
             <span className="text-xs text-gray-400">Auto-saved</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-10 shadow-xl">
            {/* Mode Switcher */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Tools</h2>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setActiveMode('section')}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${activeMode === 'section' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                        <MousePointer className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Sections</span>
                    </button>
                    <button 
                        onClick={() => setActiveMode('text')}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${activeMode === 'text' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                        <Type className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Edit Text</span>
                    </button>
                    <button 
                        onClick={() => setActiveMode('image')}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${activeMode === 'image' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Images</span>
                    </button>
                    <button 
                        onClick={() => setActiveMode('theme')}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${activeMode === 'theme' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                        <Palette className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Theme</span>
                    </button>
                </div>
            </div>

            {/* Contextual Editor Panel */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeMode === 'theme' ? (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b pb-2 mb-4 dark:border-gray-700">
                             <h3 className="text-sm font-bold text-gray-900 dark:text-white">Color Palette</h3>
                        </div>
                        
                        <button
                             onClick={handleRegeneratePalette}
                             disabled={loading}
                             className="w-full flex justify-center items-center py-2 px-4 mb-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            <Shuffle className="w-4 h-4 mr-2" /> Regenerate Palette
                        </button>

                        <div className="space-y-3">
                            {['primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'].map(key => (
                                <div key={key} className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="text" 
                                            value={colors[key] || ''} 
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="w-20 text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                        <input 
                                            type="color" 
                                            value={colors[key] || '#000000'} 
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleSaveTheme}
                            disabled={loading}
                            className="w-full mt-6 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Apply Theme
                        </button>
                    </div>
                ) : !selectedItem ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">
                            {activeMode === 'section' && "Select a section to regenerate it with AI."}
                            {activeMode === 'text' && "Click on any text to edit it."}
                            {activeMode === 'image' && "Click on an image to replace it."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b pb-2 mb-4 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                                Edit {selectedItem.type}
                            </h3>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* SECTION REGENERATOR */}
                        {selectedItem.type === 'section' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        AI Instruction
                                    </label>
                                    <textarea
                                        value={instruction}
                                        onChange={(e) => setInstruction(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 dark:bg-gray-700 dark:text-white"
                                        placeholder="e.g., Change the background to dark blue and make the text larger."
                                    />
                                </div>
                                <button
                                    onClick={handleRegenerateSection}
                                    disabled={loading || !instruction}
                                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    Regenerate
                                </button>
                            </>
                        )}

                        {/* TEXT EDITOR */}
                        {selectedItem.type === 'text' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Content
                                    </label>
                                    <textarea
                                        value={textValue}
                                        onChange={(e) => setTextValue(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveText}
                                    disabled={loading || !textValue}
                                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save Changes
                                </button>
                            </>
                        )}

                        {/* IMAGE EDITOR */}
                        {selectedItem.type === 'image' && (
                            <>
                                <div className="mb-4">
                                    <img src={selectedItem.value} alt="Preview" className="w-full h-32 object-cover rounded-md border dark:border-gray-700" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Upload New Image
                                    </label>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-400 transition-colors">
                                        <div className="space-y-1 text-center">
                                            {imageFile ? (
                                                <div className="text-sm text-gray-900 dark:text-white font-medium break-all">
                                                    {imageFile.name}
                                                    <button type="button" onClick={() => setImageFile(null)} className="ml-2 text-red-500">x</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                                        <label htmlFor="img-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                                                            <span>Upload file</span>
                                                            <input id="img-upload" type="file" className="sr-only" onChange={(e) => setImageFile(e.target.files[0])} accept="image/*" />
                                                        </label>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveImage}
                                    disabled={loading || !imageFile}
                                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Replace Image
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </aside>

        {/* Preview Area */}
        <main className="flex-1 bg-gray-200 dark:bg-gray-900 relative flex items-center justify-center p-8">
            <div className="w-full h-full bg-white shadow-2xl rounded-lg overflow-hidden relative">
                <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={`/sites/${id}/index.html`}
                    className="w-full h-full border-0"
                    title="Site Preview"
                    onLoad={handleIframeLoad}
                />
                
                {loading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="text-center">
                            <Loader className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Updating...</h3>
                        </div>
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default Editor;