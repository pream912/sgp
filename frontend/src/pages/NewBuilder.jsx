import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

const STYLE_PRESETS = [
    { id: 'standard', name: 'Standard', desc: 'Balanced & Modern' },
    { id: 'vibrant', name: 'Vibrant', desc: 'Bold & High Contrast' },
    { id: 'minimal', name: 'Minimal', desc: 'Clean & Spacious' },
    { id: 'soft', name: 'Soft', desc: 'Glassmorphism & Gradients' },
    { id: 'professional', name: 'Professional', desc: 'Corporate & Trust' },
];

const NewBuilder = () => {
    const navigate = useNavigate();
    
    // State
    const [step, setStep] = useState(1); // 1: Vision, 2: Config, 3: Generation
    const [credits, setCredits] = useState(0);
    
    // Data
    const [visionQuery, setVisionQuery] = useState('');
    const [siteType, setSiteType] = useState('landing'); // landing, portfolio, ecommerce
    const [pages, setPages] = useState({ home: true, about: true, contact: true, blog: false, pricing: false });
    const [style, setStyle] = useState('standard');
    
    // Terminal Logs
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchCredits = async () => {
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                try {
                    const res = await axios.get('/api/credits', { headers: { Authorization: `Bearer ${token}` } });
                    setCredits(res.data.credits);
                } catch (e) { console.error(e); }
            }
        };
        fetchCredits();
    }, []);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleBuild = async () => {
        setStep(3);
        addLog("Initializing build sequence...");
        addLog(`Analyzing requirements for ${siteType}...`);
        
        try {
            const token = await auth.currentUser.getIdToken();
            
            // 1. Simulate Analysis (or actually call extract-info if needed, but we might skip for this wizard flow and let AI Architect do it)
            // We'll just pass the raw visionQuery to the backend builder
            
            addLog("Generating design system...");
            
            const payload = new FormData();
            // Construct User Context from Vision + Config
            const context = `
            Business Description: ${visionQuery}
            Type: ${siteType}
            Style: ${style}
            Pages: ${Object.keys(pages).filter(k => pages[k]).join(', ')}
            `;
            
            payload.append('userContext', context);
            payload.append('businessQuery', visionQuery.substring(0, 50)); // Short title
            payload.append('stylePreset', style);
            payload.append('pages', JSON.stringify(Object.keys(pages).filter(k => pages[k]).map(p => p.charAt(0).toUpperCase() + p.slice(1))));

            const response = await axios.post('/api/build', payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                addLog("Build successful! Redirecting...");
                setTimeout(() => navigate('/'), 1000);
            }

        } catch (error) {
            addLog("Error: " + error.message);
            setStep(2); // Go back
        }
    };

    return (
        <div className="flex flex-col items-center justify-start py-10 px-4 md:px-8">
            <div className="w-full max-w-6xl flex flex-col gap-8 animate-fade-in">
                
                <div className="text-center space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Create New Project</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Define your vision, configure the structure, and let our AI build your headless website in minutes.</p>
                </div>

                {/* Stepper */}
                <div className="w-full bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-1 mb-8">
                    <div className="flex justify-between items-center relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 z-0 mx-4 md:mx-12 rounded"></div>
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-orange-500 z-0 mx-4 md:mx-12 rounded transition-all duration-500`} style={{ width: `${(step-1)*50}%` }}></div>
                        
                        <div className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={() => setStep(1)}>
                            <div className={`size-8 rounded-full flex items-center justify-center ring-4 ring-surface-light dark:ring-surface-dark ${step >= 1 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            </div>
                            <span className={`text-xs font-semibold ${step >= 1 ? 'text-orange-500' : 'text-slate-500'}`}>Concept</span>
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={() => step >= 2 && setStep(2)}>
                            <div className={`size-8 rounded-full flex items-center justify-center ring-4 ring-surface-light dark:ring-surface-dark ${step >= 2 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                <span className="material-symbols-outlined text-[18px]">tune</span>
                            </div>
                            <span className={`text-xs font-semibold ${step >= 2 ? 'text-orange-500' : 'text-slate-500'}`}>Configuration</span>
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer opacity-60">
                            <div className={`size-8 rounded-full flex items-center justify-center ring-4 ring-surface-light dark:ring-surface-dark ${step >= 3 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                <span className="material-symbols-outlined text-[18px]">terminal</span>
                            </div>
                            <span className={`text-xs font-semibold ${step >= 3 ? 'text-orange-500' : 'text-slate-500'}`}>Generation</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Form */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        
                        {/* Section 1: Vision */}
                        <section className={`bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${step === 1 ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900' : 'opacity-80'}`}>
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center cursor-pointer" onClick={() => setStep(1)}>
                                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="flex items-center justify-center size-6 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold">1</span>
                                    Vision
                                </h3>
                                {step > 1 && (
                                    <span className="text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check</span> Completed
                                    </span>
                                )}
                            </div>
                            {step === 1 && (
                                <div className="p-5 animate-fade-in">
                                    <div className="relative mb-4">
                                        <textarea 
                                            className="w-full h-32 p-4 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 resize-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" 
                                            placeholder="Describe your business (e.g., A modern coffee shop in Seattle specializing in cold brew...)"
                                            value={visionQuery}
                                            onChange={(e) => setVisionQuery(e.target.value)}
                                        ></textarea>
                                    </div>
                                    <div className="flex gap-2 mb-6">
                                        {['SaaS Landing', 'Portfolio', 'E-commerce'].map(t => (
                                            <button 
                                                key={t}
                                                onClick={() => setSiteType(t.toLowerCase().includes('saas') ? 'landing' : t.toLowerCase())}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${siteType === (t.toLowerCase().includes('saas') ? 'landing' : t.toLowerCase()) ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-300'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => setStep(2)}
                                        disabled={!visionQuery}
                                        className="w-full py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                    >
                                        Next: Configuration
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Section 2: Configuration */}
                        <section className={`bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${step === 2 ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900' : 'opacity-80'}`}>
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center cursor-pointer" onClick={() => step > 1 && setStep(2)}>
                                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="flex items-center justify-center size-6 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold">2</span>
                                    Configuration
                                </h3>
                            </div>
                            {step === 2 && (
                                <div className="p-6 space-y-8 animate-fade-in">
                                    
                                    {/* Site Structure */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">layers</span>
                                            Site Pages
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {Object.keys(pages).map(pageKey => (
                                                <label key={pageKey} className="cursor-pointer relative group">
                                                    <input 
                                                        type="checkbox" 
                                                        className="peer sr-only"
                                                        checked={pages[pageKey]}
                                                        onChange={() => setPages(p => ({...p, [pageKey]: !p[pageKey]}))}
                                                        disabled={pageKey === 'home'}
                                                    />
                                                    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${pages[pageKey] ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{pageKey}</span>
                                                        {pages[pageKey] && <span className="material-symbols-outlined text-orange-500 text-[18px] ml-auto">check_circle</span>}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visual Identity */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">palette</span>
                                            Visual Identity
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {STYLE_PRESETS.slice(0, 3).map(preset => (
                                                <label key={preset.id} className="cursor-pointer group">
                                                    <input 
                                                        type="radio" 
                                                        name="style" 
                                                        className="peer sr-only"
                                                        checked={style === preset.id}
                                                        onChange={() => setStyle(preset.id)}
                                                    />
                                                    <div className={`h-full flex flex-col rounded-xl border p-4 transition-all ${style === preset.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-orange-200'}`}>
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{preset.name}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">{preset.desc}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column: Status / Terminal */}
                    <div className="lg:col-span-5 flex flex-col gap-6 sticky top-24 h-fit">
                        <section className="bg-[#1e1e2e] rounded-xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[420px]">
                            <div className="bg-[#2a2a3c] px-4 py-2 flex items-center justify-between border-b border-slate-700">
                                <div className="flex gap-2">
                                    <div className="size-3 rounded-full bg-[#ff5f56]"></div>
                                    <div className="size-3 rounded-full bg-[#ffbd2e]"></div>
                                    <div className="size-3 rounded-full bg-[#27c93f]"></div>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">terminal</span>
                                    builder-cli — zsh
                                </div>
                                <div className="w-10"></div> 
                            </div>
                            <div className="p-4 font-mono text-xs md:text-sm text-slate-300 overflow-y-auto flex-1 space-y-2">
                                <div className="text-slate-500 mb-4 select-none"># Waiting for generation trigger...</div>
                                {visionQuery && step >= 1 && (
                                    <div className="flex gap-2">
                                        <span className="text-orange-500 font-bold">❯</span>
                                        <span>Analyzing input: "{visionQuery.substring(0, 30)}..."</span>
                                    </div>
                                )}
                                {step >= 2 && (
                                     <div className="flex gap-2">
                                        <span className="text-orange-500 font-bold">❯</span>
                                        <span>Configuring {siteType} structure...</span>
                                    </div>
                                )}
                                {logs.map((log, i) => (
                                     <div key={i} className="flex gap-2">
                                        <span className="text-orange-500 font-bold">❯</span>
                                        <span>{log}</span>
                                    </div>
                                ))}
                                {step === 3 && (
                                     <div className="flex gap-2">
                                        <span className="text-orange-500 font-bold">❯</span>
                                        <span className="animate-pulse">Building project assets...</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Estimated Cost</p>
                                    <p className="text-xs text-slate-500">Based on pages selected</p>
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">150 <span className="text-sm font-normal text-slate-500">credits</span></span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={handleBuild}
                                    disabled={step < 2 || credits < 150}
                                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                                    {step === 3 ? 'Building...' : 'Build Website'}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default NewBuilder;
