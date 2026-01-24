import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import { ArrowLeft, Upload, Loader, Search, Check, Palette, AlertCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

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

const STYLE_PRESETS = [
    { id: 'standard', name: 'Standard', desc: 'Balanced & Modern' },
    { id: 'vibrant', name: 'Vibrant', desc: 'Bold & High Contrast' },
    { id: 'minimal', name: 'Minimal', desc: 'Clean & Spacious' },
    { id: 'soft', name: 'Soft', desc: 'Glassmorphism & Gradients' },
    { id: 'professional', name: 'Professional', desc: 'Corporate & Trust' },
    { id: 'neumorphic', name: 'Neumorphic', desc: 'Soft 3D Plastic' },
];

const NewBuilder = () => {
  const [step, setStep] = useState(1); // 1: Search, 2: Details, 3: Visuals, 4: Building
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logo, setLogo] = useState(null);
  const [selectedPalette, setSelectedPalette] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('standard');
  const [buildStatus, setBuildStatus] = useState('');
  
  // New State for Multi-page
  const [siteType, setSiteType] = useState('single'); // 'single' | 'multi'
  const [selectedPages, setSelectedPages] = useState(['Home']);
  const [credits, setCredits] = useState(0);
  const [fetchingCredits, setFetchingCredits] = useState(true);
  
  const AVAILABLE_PAGES = ['About', 'Services', 'Gallery', 'Contact', 'Portfolio', 'Testimonials', 'Team'];

  useEffect(() => {
    const fetchCredits = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                const res = await axios.get('/api/credits', { headers: { Authorization: `Bearer ${token}` } });
                setCredits(res.data.credits);
            }
        } catch (e) {
            console.error('Failed to fetch credits', e);
        } finally {
            setFetchingCredits(false);
        }
    };
    fetchCredits();
  }, []);

  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
    address: '',
    phone: '',
    email: '',
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

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await axios.post('/api/extract-info', { query: searchQuery }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Backend now returns a structured JSON object in userContext
      const data = response.data.userContext;
      parseExtractedData(data);
      setStep(2);
    } catch (error) {
      console.error('Extraction failed:', error);
      alert('Could not find business info. Please enter details manually.');
      setStep(2); // Fallback to manual entry
    } finally {
      setLoading(false);
    }
  };

  const parseExtractedData = (data) => {
    if (!data) return;

    // Handle reviews splitting
    let parsedReviews = [];
    if (Array.isArray(data.reviews)) {
        parsedReviews = data.reviews;
    } else if (typeof data.reviews === 'string') {
        // robustly handle different separators (double newline, single newline, pipe)
        parsedReviews = data.reviews.split(/\n\n|\r\n\r\n|\|/).map(r => r.trim()).filter(r => r.length > 5);
        // If that didn't work (e.g. single block), try single newlines if it looks like a list
        if (parsedReviews.length <= 1 && data.reviews.includes('\n')) {
             parsedReviews = data.reviews.split(/\n/).map(r => r.trim()).filter(r => r.length > 5);
        }
    }

    setFormData({
      name: data.name || searchQuery,
      industry: data.industry || '',
      description: data.description || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
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
    });
  };

  const handleBuild = async () => {
    setStep(4);
    setBuildStatus('Initializing build...');
    
    try {
      const token = await auth.currentUser.getIdToken();
      const payload = new FormData();
      
      // Combine reviews
      const combinedReviews = [formData.review1, formData.review2, formData.review3]
        .filter(r => r.trim())
        .map(r => `"${r.trim()}"`)
        .join('\n');

      // Construct the final User Context string (Sam.txt style)
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

      payload.append('userContext', finalContext);
      payload.append('businessQuery', formData.name);
      payload.append('stylePreset', selectedStyle);
      
      // Send selected pages (ensure Home is always included first)
      const finalPages = siteType === 'single' ? ['Home'] : ['Home', ...selectedPages.filter(p => p !== 'Home')];
      payload.append('pages', JSON.stringify(finalPages));
      
      if (logo) {
        payload.append('logo', logo);
      } else if (selectedPalette) {
         payload.append('userContext', finalContext + `

**STRICT COLOR PALETTE**
Use these exact colors:
Primary: ${selectedPalette.colors.primary}
Secondary: ${selectedPalette.colors.secondary}
Accent: ${selectedPalette.colors.accent}
Background: ${selectedPalette.colors.background}
Text: ${selectedPalette.colors.text}
Button Background: ${selectedPalette.colors.buttonBackground}
Button Text: ${selectedPalette.colors.buttonText}`);
      }

      setBuildStatus('Generating Design System...');
      
      const response = await axios.post('/api/build', payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setBuildStatus('Deploying...');
        navigate('/');
      }

    } catch (error) {
      console.error('Build failed:', error);
      setBuildStatus('Failed');
      alert('Build failed: ' + (error.response?.data?.error || error.message));
      setStep(3);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                <ArrowLeft className="h-5 w-5 mr-1" /> Dashboard
            </button>
            <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4">
        {step === 4 ? (
            <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                <Loader className="h-16 w-16 text-indigo-600 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Building Your Website</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">{buildStatus}</p>
            </div>
        ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
                {/* Progress Bar */}
                <div className="bg-gray-100 dark:bg-gray-700 h-2 w-full">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${step * 33.3}%` }}></div>
                </div>

                <div className="p-8">
                    {step === 1 && (
                        <div className="text-center py-10">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Start with a Search</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-8">Enter your business name or Google Maps URL to auto-fill your website details.</p>
                            
                            <form onSubmit={handleSearch} className="max-w-xl mx-auto relative">
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-gray-200 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg dark:bg-gray-700 dark:text-white"
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
                                    {loading ? 'Searching...' : 'Go'}
                                </button>
                            </form>
                            <button onClick={() => setStep(2)} className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
                                Skip search and enter manually
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Business Details</h2>
                            
                            {/* Website Structure Selection */}
                            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Website Structure</h3>
                                <div className="flex space-x-6 mb-4">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="siteType" 
                                            value="single" 
                                            checked={siteType === 'single'} 
                                            onChange={() => {
                                                setSiteType('single');
                                                setSelectedPages(['Home']);
                                            }}
                                            className="form-radio h-5 w-5 text-indigo-600"
                                        />
                                        <span className="text-gray-900 dark:text-white font-medium">Single Page Site</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="siteType" 
                                            value="multi" 
                                            checked={siteType === 'multi'} 
                                            onChange={() => setSiteType('multi')}
                                            className="form-radio h-5 w-5 text-indigo-600"
                                        />
                                        <span className="text-gray-900 dark:text-white font-medium">Multi-Page Site</span>
                                    </label>
                                </div>

                                {siteType === 'multi' && (
                                    <div className="mt-4 animate-fadeIn">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Select the pages you need:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <label className="flex items-center space-x-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 opacity-75 cursor-not-allowed">
                                                <input type="checkbox" checked disabled className="rounded text-indigo-600" />
                                                <span className="text-gray-700 dark:text-gray-300 text-sm">Home</span>
                                            </label>
                                            {AVAILABLE_PAGES.map(page => (
                                                <label key={page} className="flex items-center space-x-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-indigo-500">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedPages.includes(page)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedPages([...selectedPages, page]);
                                                            } else {
                                                                setSelectedPages(selectedPages.filter(p => p !== page));
                                                            }
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500" 
                                                    />
                                                    <span className="text-gray-700 dark:text-gray-300 text-sm">{page}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.industry}
                                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                    <textarea
                                        rows={3}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>

                                {/* Contact Info */}
                                <div className="col-span-2"><h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4 border-b pb-2">Contact & Location</h3></div>
                                
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>

                                {/* Socials */}
                                <div className="col-span-2"><h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4 border-b pb-2">Social Media</h3></div>
                                
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facebook</label>
                                    <input type="text" className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.facebook} onChange={(e) => setFormData({...formData, facebook: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instagram</label>
                                    <input type="text" className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.instagram} onChange={(e) => setFormData({...formData, instagram: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Twitter (X)</label>
                                    <input type="text" className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.twitter} onChange={(e) => setFormData({...formData, twitter: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LinkedIn</label>
                                    <input type="text" className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.linkedin} onChange={(e) => setFormData({...formData, linkedin: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTube</label>
                                    <input type="text" className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white" value={formData.youtube} onChange={(e) => setFormData({...formData, youtube: e.target.value})} />
                                </div>

                                {/* Details */}
                                <div className="col-span-2"><h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4 border-b pb-2">More Details</h3></div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opening Hours</label>
                                    <textarea
                                        rows={4}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        placeholder="Mon-Fri: 9am - 5pm..."
                                        value={formData.openingHours}
                                        onChange={(e) => setFormData({...formData, openingHours: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Services (One per line)</label>
                                    <textarea
                                        rows={4}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        value={formData.services}
                                        onChange={(e) => setFormData({...formData, services: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling Points / Highlights</label>
                                    <textarea
                                        rows={3}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                        placeholder="e.g. Free consultations, Family owned..."
                                        value={formData.sellingPoints}
                                        onChange={(e) => setFormData({...formData, sellingPoints: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Featured Reviews</label>
                                    <div className="space-y-3">
                                        <textarea
                                            rows={2}
                                            placeholder="Review 1"
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                            value={formData.review1}
                                            onChange={(e) => setFormData({...formData, review1: e.target.value})}
                                        />
                                        <textarea
                                            rows={2}
                                            placeholder="Review 2"
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                            value={formData.review2}
                                            onChange={(e) => setFormData({...formData, review2: e.target.value})}
                                        />
                                        <textarea
                                            rows={2}
                                            placeholder="Review 3"
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-3 dark:bg-gray-700 dark:text-white"
                                            value={formData.review3}
                                            onChange={(e) => setFormData({...formData, review3: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setStep(3)}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
                                >
                                    Next: Visuals
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Visual Identity</h2>
                            
                            {/* Style Selection - NEW */}
                            <div className="mb-8">
                                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">1. Choose a Style Vibe</label>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {STYLE_PRESETS.map((style) => (
                                        <button
                                            key={style.id}
                                            onClick={() => setSelectedStyle(style.id)}
                                            className={`relative rounded-lg p-4 border-2 transition-all flex flex-col items-center justify-center text-center space-y-2 h-32 ${selectedStyle === style.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                                        >
                                            <span className={`font-bold text-sm ${selectedStyle === style.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>{style.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{style.desc}</span>
                                            
                                            {selectedStyle === style.id && (
                                                <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-0.5">
                                                    <Check className="h-3 w-3" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-8">
                                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">2. Upload Logo (Optional)</label>
                                <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                                    <div className="space-y-1 text-center">
                                        {logo ? (
                                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                {logo.name}
                                                <button type="button" onClick={() => setLogo(null)} className="ml-2 text-red-500 hover:text-red-700">Remove</button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                                        <span>Upload a file</span>
                                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => setLogo(e.target.files[0])} accept="image/*" />
                                                    </label>
                                                    <p className="pl-1">or drag and drop</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Uploading a logo will automatically generate a matching color palette.</p>
                            </div>

                            {!logo && (
                                <div>
                                    <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">3. Choose a Color Palette (Optional)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                        {PALETTE_PRESETS.map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => setSelectedPalette(p)}
                                                className={`relative rounded-lg p-2 border-2 transition-all ${selectedPalette?.name === p.name ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-transparent hover:border-gray-200'}`}
                                            >
                                                <div className="h-16 w-full rounded-md mb-2 flex overflow-hidden">
                                                    <div style={{ backgroundColor: p.colors.primary }} className="flex-1"></div>
                                                    <div style={{ backgroundColor: p.colors.secondary }} className="flex-1"></div>
                                                    <div style={{ backgroundColor: p.colors.accent }} className="flex-1"></div>
                                                </div>
                                                <div className="text-center text-xs font-medium text-gray-900 dark:text-gray-300">{p.name}</div>
                                                {selectedPalette?.name === p.name && (
                                                    <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex justify-between items-center">
                                <button
                                    onClick={() => setStep(2)}
                                    className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-6 py-2"
                                >
                                    Back
                                </button>
                                
                                <div className="flex flex-col items-end">
                                    <button
                                        onClick={handleBuild}
                                        disabled={(credits < (siteType === 'multi' ? 400 : 200))}
                                        className="bg-indigo-600 text-white px-8 py-3 rounded-md hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        Build My Site ({siteType === 'multi' ? '400' : '200'} Credits)
                                    </button>
                                    {credits < (siteType === 'multi' ? 400 : 200) && (
                                        <div className="text-red-500 text-sm mt-2 flex items-center">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            Insufficient Credits ({credits} available)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default NewBuilder;
