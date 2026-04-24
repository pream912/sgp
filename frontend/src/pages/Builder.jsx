import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { ArrowLeft, Search, Check, Upload, Loader, AlertCircle, ChevronRight, Layout, Type, Image as ImageIcon, Briefcase, MapPin, Globe, Mail, Phone, Facebook, Instagram, Twitter, Linkedin, Youtube, FileText } from 'lucide-react';
import { useCredits } from '../context/CreditsContext';
import BuyCreditsModal from '../components/BuyCreditsModal';

const STYLE_PRESETS = [
    { 
        id: 'standard', 
        name: 'Standard', 
        desc: 'Clean, modern, and accessible. Balanced spacing with standard rounded corners.' 
    },
    { 
        id: 'vibrant', 
        name: 'Vibrant', 
        desc: 'High energy, bold colors, and hard shadows. A Neo-Brutalism aesthetic.' 
    },
    { 
        id: 'minimal', 
        name: 'Minimal', 
        desc: 'Maximum whitespace, focus on typography. "Less is more" philosophy.' 
    },
    { 
        id: 'soft', 
        name: 'Soft', 
        desc: 'Ethereal and translucent. Glassmorphism effects with smooth gradients.' 
    },
    { 
        id: 'professional', 
        name: 'Professional', 
        desc: 'Trustworthy and organized. Corporate SaaS style with strict grids.' 
    },
    { 
        id: 'neumorphic', 
        name: 'Neumorphic', 
        desc: 'Soft UI where elements appear extruded from the background.' 
    }
];
const AVAILABLE_PAGES = ['About', 'Services', 'Gallery', 'Contact', 'Portfolio', 'Testimonials', 'Team'];

const PALETTE_PRESETS = [
  { name: 'Oceanic', colors: { primary: '#0ea5e9', secondary: '#0284c7', accent: '#38bdf8', background: '#f0f9ff', text: '#0c4a6e', buttonBackground: '#0284c7', buttonText: '#ffffff' } },
  { name: 'Forest', colors: { primary: '#22c55e', secondary: '#16a34a', accent: '#4ade80', background: '#f0fdf4', text: '#14532d', buttonBackground: '#16a34a', buttonText: '#ffffff' } },
  { name: 'Sunset', colors: { primary: '#f97316', secondary: '#ea580c', accent: '#fb923c', background: '#fff7ed', text: '#7c2d12', buttonBackground: '#ea580c', buttonText: '#ffffff' } },
  { name: 'Berry', colors: { primary: '#d946ef', secondary: '#c026d3', accent: '#e879f9', background: '#fdf4ff', text: '#701a75', buttonBackground: '#c026d3', buttonText: '#ffffff' } },
  { name: 'Slate', colors: { primary: '#64748b', secondary: '#475569', accent: '#94a3b8', background: '#f8fafc', text: '#0f172a', buttonBackground: '#475569', buttonText: '#ffffff' } },
  { name: 'Midnight', colors: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8', background: '#eef2ff', text: '#312e81', buttonBackground: '#4f46e5', buttonText: '#ffffff' } },
  { name: 'Crimson', colors: { primary: '#e11d48', secondary: '#be123c', accent: '#f43f5e', background: '#fff1f2', text: '#881337', buttonBackground: '#be123c', buttonText: '#ffffff' } },
  { name: 'Amber', colors: { primary: '#d97706', secondary: '#b45309', accent: '#f59e0b', background: '#fffbeb', text: '#78350f', buttonBackground: '#b45309', buttonText: '#ffffff' } },
  { name: 'Teal', colors: { primary: '#14b8a6', secondary: '#0d9488', accent: '#2dd4bf', background: '#f0fdfa', text: '#134e4a', buttonBackground: '#0d9488', buttonText: '#ffffff' } },
  { name: 'Luxury', colors: { primary: '#d4af37', secondary: '#aa8c2c', accent: '#f3e5ab', background: '#1c1c1c', text: '#ffffff', buttonBackground: '#d4af37', buttonText: '#000000' } },
];

const STEPS = [
    { id: 1, name: 'Search', icon: Search },
    { id: 2, name: 'Structure', icon: Layout },
    { id: 3, name: 'Content', icon: FileText },
    { id: 4, name: 'Visuals', icon: ImageIcon },
];

const Builder = () => {
    const navigate = useNavigate();
    const { credits } = useCredits();
    const [showBuyCredits, setShowBuyCredits] = useState(false);

    // Global State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [buildStatus, setBuildStatus] = useState('');
    
    // Step 1: Query
    const [searchQuery, setSearchQuery] = useState('');

    // Step 2: Structure
    const [siteType, setSiteType] = useState('single'); // 'single' | 'multi'
    const [selectedPages, setSelectedPages] = useState(['Home']);

    // Step 3: Content
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        description: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        services: '',
        sellingPoints: '',
        review1: '',
        review2: '',
        review3: '',
        openingHours: '',
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: ''
    });

    // Step 4: Visuals
    const [logo, setLogo] = useState(null);
    const [stylePreset, setStylePreset] = useState('standard');
    const [selectedPalette, setSelectedPalette] = useState(null);

    const calculateCost = () => {
        const baseCost = 200;
        const pageCost = 100;
        const numExtraPages = siteType === 'single' ? 0 : Math.max(0, selectedPages.length - 1);
        const totalPageCost = numExtraPages * pageCost;
        return {
            base: baseCost,
            pageUnit: pageCost,
            extraPages: numExtraPages,
            pagesTotal: totalPageCost,
            total: baseCost + totalPageCost
        };
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.post('/api/extract', { query: searchQuery }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const data = response.data.data;
            if (data) parseExtractedData(data);
            setStep(2);
        } catch (error) {
            console.error('Extraction failed:', error);
            alert('Could not find business info. Please enter details manually.');
            setStep(2); 
        } finally {
            setLoading(false);
        }
    };

    const parseExtractedData = (data) => {
        if (!data) return;
        let parsedReviews = [];
        if (Array.isArray(data.reviews)) {
            parsedReviews = data.reviews;
        } else if (typeof data.reviews === 'string') {
            parsedReviews = data.reviews.split(/\n\n|\r\n\r\n|\|/).map(r => r.trim()).filter(r => r.length > 5);
        }

        setFormData(prev => ({
            ...prev,
            name: data.name || searchQuery,
            industry: data.industry || '',
            description: data.description || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            website: data.website || '',
            services: Array.isArray(data.services) ? data.services.join('\n') : (data.services || ''),
            sellingPoints: Array.isArray(data.sellingPoints) ? data.sellingPoints.join('\n') : (data.sellingPoints || ''),
            review1: parsedReviews[0] || '',
            review2: parsedReviews[1] || '',
            review3: parsedReviews[2] || '',
            openingHours: data.openingHours || '',
            facebook: data.socials?.facebook || '',
            instagram: data.socials?.instagram || '',
            twitter: data.socials?.twitter || '',
            linkedin: data.socials?.linkedin || '',
            youtube: data.socials?.youtube || ''
        }));
    };

    const handleBuild = async () => {
        setLoading(true);
        setBuildStatus('Initializing build...');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const costs = calculateCost();

            if (credits < costs.total) {
                throw new Error(`Insufficient credits. Required: ${costs.total}, Available: ${credits}`);
            }

            // Construct Context
             const combinedReviews = [formData.review1, formData.review2, formData.review3] 
                .filter(r => r.trim()) 
                .map(r => `"${r.trim()}"`) 
                .join('\n');

            const finalContext = `
**Business Name**: ${formData.name}
**Business Summary**: ${formData.description}
**Industry**: ${formData.industry}

**Selling Points**:
${formData.sellingPoints}

**Contact Details**
*   **Address**: ${formData.address}
*   **Phone**: ${formData.phone}
*   **Email**: ${formData.email}
*   **Website**: ${formData.website}

**Social Media**
*   Facebook: ${formData.facebook}
*   Instagram: ${formData.instagram}
*   Twitter: ${formData.twitter}
*   LinkedIn: ${formData.linkedin}
*   YouTube: ${formData.youtube}

**Opening Hours**
${formData.openingHours}

**Key Services**
${formData.services}

**Reviews/Testimonials**
${combinedReviews}
      `;
            
            // Append color logic if manual palette selected
            let finalUserContext = finalContext;
             if (!logo && selectedPalette) {
                finalUserContext += `\n\n**STRICT COLOR PALETTE**
Use these exact colors:
Primary: ${selectedPalette.colors.primary}
Secondary: ${selectedPalette.colors.secondary}
Accent: ${selectedPalette.colors.accent}
Background: ${selectedPalette.colors.background}
Text: ${selectedPalette.colors.text}
Button Background: ${selectedPalette.colors.buttonBackground}
Button Text: ${selectedPalette.colors.buttonText}`;
            }

            const payload = new FormData();
            payload.append('businessQuery', formData.name);
            payload.append('userContext', finalUserContext);
            payload.append('stylePreset', stylePreset);
            
            const finalPages = siteType === 'single' ? ['Home'] : ['Home', ...selectedPages.filter(p => p !== 'Home')];
            payload.append('pages', JSON.stringify(finalPages));
            
            if (logo) {
                payload.append('logo', logo);
            }

            setBuildStatus('Generating Design System...');
            const response = await axios.post('/api/build', payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                setBuildStatus('Deploying...');
                setTimeout(() => navigate('/sites'), 2000);
            }

        } catch (error) {
            console.error('Build failed:', error);
            setLoading(false);
            navigate('/sites');
        }
    };

    const costBreakdown = calculateCost();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f0e15] text-slate-900 dark:text-white flex flex-col font-sans transition-colors duration-200">
            
            {/* Simplified Header */}
            <div className="bg-white dark:bg-[#1a1924] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">New Project Wizard</h1>
                    </div>
                </div>
                
                {/* Stepper */}
                <div className="hidden md:flex items-center gap-2">
                    {STEPS.map((s, idx) => (
                        <div key={s.id} className="flex items-center">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${step === s.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : step > s.id ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${step === s.id ? 'bg-indigo-600 text-white' : step > s.id ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                    {step > s.id ? <Check className="w-3 h-3" /> : s.id}
                                </span>
                                <span>{s.name}</span>
                            </div>
                            {idx < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 mx-2" />}
                        </div>
                    ))}
                </div>

                <div className="w-8"></div> {/* Spacer for balance */}
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col lg:flex-row gap-8">
                
                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    {/* STEP 1: SEARCH */}
                    {step === 1 && (
                        <div className="max-w-2xl mx-auto mt-20 text-center animate-fade-in">
                            <h2 className="text-3xl font-bold mb-4">Start with a Search</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">Enter your business name or Google Maps URL to auto-fill details.</p>
                            
                            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-gray-200 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg dark:bg-gray-800 dark:text-white"
                                    placeholder="e.g. Joe's Pizza New York"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-full font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? <Loader className="animate-spin h-5 w-5" /> : 'Go'}
                                </button>
                            </form>
                            <button onClick={() => setStep(2)} className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
                                Skip search and enter manually
                            </button>
                        </div>
                    )}

                    {/* STEP 2: STRUCTURE */}
                    {step === 2 && (
                        <div className="animate-fade-in space-y-6 pb-20">
                             <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Layout className="text-blue-500 w-5 h-5" />
                                    Choose Site Structure
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <label className={`relative p-6 rounded-xl border-2 text-left cursor-pointer transition-all ${siteType === 'single' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                                        <input type="radio" name="siteType" value="single" className="sr-only" checked={siteType === 'single'} onChange={() => { setSiteType('single'); setSelectedPages(['Home']); }} />
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 mb-3">
                                                <Layout className="w-6 h-6" />
                                            </div>
                                            {siteType === 'single' && <div className="bg-indigo-500 text-white rounded-full p-1"><Check className="h-3 w-3" /></div>}
                                        </div>
                                        <span className="font-bold text-lg block mb-1">Single Page</span>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Perfect for landing pages, portfolios, and small businesses. All content on one scrollable page.</p>
                                    </label>

                                    <label className={`relative p-6 rounded-xl border-2 text-left cursor-pointer transition-all ${siteType === 'multi' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                                        <input type="radio" name="siteType" value="multi" className="sr-only" checked={siteType === 'multi'} onChange={() => setSiteType('multi')} />
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg text-purple-600 dark:text-purple-400 mb-3">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            {siteType === 'multi' && <div className="bg-indigo-500 text-white rounded-full p-1"><Check className="h-3 w-3" /></div>}
                                        </div>
                                        <span className="font-bold text-lg block mb-1">Multi-Page Site</span>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Complete business website with separate pages for About, Services, Contact, etc.</p>
                                    </label>
                                </div>

                                {siteType === 'multi' && (
                                    <div className="space-y-4 animate-fade-in bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Select Additional Pages</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">You can always add or remove pages later from the editor.</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            <label className="flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 opacity-75 cursor-not-allowed">
                                                <input type="checkbox" checked disabled className="rounded text-indigo-600" />
                                                <span className="text-gray-700 dark:text-gray-300 font-medium">Home</span>
                                            </label>
                                            {AVAILABLE_PAGES.map(page => (
                                                <label key={page} className={`flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800 border cursor-pointer hover:border-indigo-500 transition-all ${selectedPages.includes(page) ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-600'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedPages.includes(page)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedPages([...selectedPages, page]);
                                                            else setSelectedPages(selectedPages.filter(p => p !== page));
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                                                    />
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{page}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <div className="flex justify-end pt-4">
                                <button onClick={() => setStep(3)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                                    Next: Content Details <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CONTENT */}
                    {step === 3 && (
                        <div className="animate-fade-in space-y-6 pb-20">
                            
                            {/* 1. Core Info */}
                            <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <Briefcase className="text-orange-500 w-5 h-5" />
                                    Core Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Name</label>
                                        <input type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                                        <input type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                        <textarea rows={3} className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    </div>
                                </div>
                            </section>

                            {/* 2. Contact */}
                            <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <MapPin className="text-green-500 w-5 h-5" />
                                    Contact Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                            <input type="text" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                            <input type="tel" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                            <input type="email" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* 3. Socials */}
                            <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <Globe className="text-blue-500 w-5 h-5" />
                                    Social Media
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="relative">
                                        <Instagram className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="Instagram URL" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value})} />
                                    </div>
                                    <div className="relative">
                                        <Facebook className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="Facebook URL" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.facebook} onChange={e => setFormData({...formData, facebook: e.target.value})} />
                                    </div>
                                    <div className="relative">
                                        <Twitter className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="Twitter URL" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.twitter} onChange={e => setFormData({...formData, twitter: e.target.value})} />
                                    </div>
                                    <div className="relative">
                                        <Linkedin className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="LinkedIn URL" className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.linkedin} onChange={e => setFormData({...formData, linkedin: e.target.value})} />
                                    </div>
                                </div>
                            </section>

                            {/* 4. Content */}
                            <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <FileText className="text-purple-500 w-5 h-5" />
                                    Site Content
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Hours</label>
                                        <textarea rows={3} className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.openingHours} onChange={e => setFormData({...formData, openingHours: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Key Services (One per line)</label>
                                        <textarea rows={4} className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.services} onChange={e => setFormData({...formData, services: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Featured Reviews</label>
                                        <div className="space-y-3">
                                            <input type="text" placeholder="Review 1" className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.review1} onChange={e => setFormData({...formData, review1: e.target.value})} />
                                            <input type="text" placeholder="Review 2" className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.review2} onChange={e => setFormData({...formData, review2: e.target.value})} />
                                            <input type="text" placeholder="Review 3" className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.review3} onChange={e => setFormData({...formData, review3: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-between pt-4">
                                <button onClick={() => setStep(2)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-medium px-4">
                                    Back
                                </button>
                                <button onClick={() => setStep(4)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                                    Next: Visuals <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: VISUALS */}
                    {step === 4 && (
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 animate-fade-in pb-20">
                            <div className="space-y-8">
                                
                                {/* Logo */}
                                <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-4">Upload Brand Logo</h3>
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                                        {logo ? (
                                            <div className="flex flex-col items-center p-4">
                                                <Check className="text-green-500 h-8 w-8 mb-2" />
                                                <p className="font-medium text-sm">{logo.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">Click to replace</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center pt-5 pb-6">
                                                <Upload className="text-slate-400 h-8 w-8 mb-2" />
                                                <p className="text-sm text-slate-600 dark:text-slate-400">Click to upload or drag and drop</p>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setLogo(e.target.files[0])} />
                                    </label>
                                </section>

                                {/* Visual Style */}
                                <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-4">Visual Style</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {STYLE_PRESETS.map(preset => (
                                            <div 
                                                key={preset.id}
                                                onClick={() => setStylePreset(preset.id)}
                                                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${stylePreset === preset.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                            >
                                                <h4 className="font-bold text-base mb-2">{preset.name}</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{preset.desc}</p>
                                                {stylePreset === preset.id && <div className="absolute top-4 right-4 bg-orange-500 text-white rounded-full p-0.5"><Check className="h-4 w-4" /></div>}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Color Palette */}
                                {!logo && (
                                    <section className="bg-white dark:bg-[#1a1924] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <h3 className="text-lg font-bold mb-4">Color Palette</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {PALETTE_PRESETS.map((p) => (
                                                <button
                                                    key={p.name}
                                                    onClick={() => setSelectedPalette(p)}
                                                    className={`relative rounded-lg p-2 border-2 transition-all ${selectedPalette?.name === p.name ? 'border-indigo-600 ring-1 ring-indigo-200' : 'border-transparent hover:border-gray-200'}`}
                                                >
                                                    <div className="h-10 w-full rounded-md mb-2 flex overflow-hidden">
                                                        <div style={{ backgroundColor: p.colors.primary }} className="flex-1"></div>
                                                        <div style={{ backgroundColor: p.colors.secondary }} className="flex-1"></div>
                                                        <div style={{ backgroundColor: p.colors.accent }} className="flex-1"></div>
                                                    </div>
                                                    <div className="text-center text-xs font-medium text-gray-900 dark:text-gray-300">{p.name}</div>
                                                    {selectedPalette?.name === p.name && (
                                                        <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5"><Check className="h-2 w-2" /></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Sidebar - Visible from Step 2 onwards */}
                {step >= 2 && (
                     <div className="w-full lg:w-[350px] shrink-0">
                        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl sticky top-24">
                            <h4 className="font-bold text-lg mb-4 border-b border-slate-700 pb-2 flex justify-between items-center">
                                Project Summary
                                {step < 4 && <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded">Draft</span>}
                            </h4>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Business</p>
                                    <p className="font-semibold text-base truncate">{formData.name || 'Untitled'}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Type</span>
                                    <span className="font-semibold capitalize bg-slate-800 px-2 py-0.5 rounded text-xs">{siteType} Site</span>
                                </div>
                                
                                {/* Cost Breakdown */}
                                <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 mt-4">
                                    <div className="flex justify-between text-xs text-slate-300">
                                        <span>Base Construction</span>
                                        <span>{costBreakdown.base} cr</span>
                                    </div>
                                    {costBreakdown.extraPages > 0 && (
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>Extra Pages ({costBreakdown.extraPages})</span>
                                            <span>+{costBreakdown.pagesTotal} cr</span>
                                        </div>
                                    )}
                                    <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                                        <span className="text-slate-200 font-medium">Total Cost</span>
                                        <span className="text-xl font-bold text-orange-400">{costBreakdown.total} <span className="text-xs font-normal text-slate-400">cr</span></span>
                                    </div>
                                </div>

                                <div className="text-center text-xs text-slate-500 mt-2">
                                    Available Balance: <span className={credits >= costBreakdown.total ? "text-green-400" : "text-red-400"}>{credits} cr</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-8">
                                {step === 4 ? (
                                    <>
                                        {loading ? (
                                            <div className="bg-orange-500/20 text-orange-400 p-4 rounded-xl text-center font-bold border border-orange-500/30 flex items-center justify-center gap-3">
                                                <Loader className="animate-spin h-5 w-5" /> Building...
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handleBuild}
                                                disabled={loading || credits < costBreakdown.total}
                                                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                            >
                                                Start Build <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                            </button>
                                        )}
                                        
                                        {credits < costBreakdown.total && (
                                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs mt-3 p-3 rounded-lg text-center">
                                                <div className="flex items-center justify-center gap-2 mb-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    <span>Insufficient Credits</span>
                                                </div>
                                                <button onClick={() => setShowBuyCredits(true)} className="text-orange-400 hover:text-orange-300 underline font-medium">
                                                    Buy Credits
                                                </button>
                                            </div>
                                        )}
                                        
                                        <button onClick={() => setStep(3)} className="w-full mt-3 text-slate-400 hover:text-white text-sm py-2">Back to Content</button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => setStep(step + 1)}
                                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors"
                                    >
                                        Next Step
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <BuyCreditsModal isOpen={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
        </div>
    );
};

export default Builder;
