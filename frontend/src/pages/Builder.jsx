import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import { ArrowLeft, Upload, Loader } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Builder = () => {
  const [mode, setMode] = useState('query'); // 'query' or 'url'
  const [input, setInput] = useState('');
  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(''); // 'extracting', 'building', 'deploying'
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Initializing...');

    try {
      const token = await auth.currentUser.getIdToken();
      
      const formData = new FormData();
      if (mode === 'query') {
        formData.append('businessQuery', input);
      } else {
        formData.append('businessUrl', input);
      }
      
      if (logo) {
        formData.append('logo', logo);
      }

      setStatus('AI is analyzing your request...');
      
      // Long-running request
      const response = await axios.post('/api/build', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setStatus('Complete!');
        navigate('/'); // Go back to dashboard to see the new project
      }
      
    } catch (error) {
      console.error('Build failed:', error);
      alert('Build failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                <ArrowLeft className="h-5 w-5 mr-1" /> Back to Dashboard
            </button>
            <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden max-w-2xl w-full transition-colors duration-200">
            {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                    <Loader className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Building your site...</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">{status}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">This usually takes about 30-60 seconds.</p>
                </div>
            ) : (
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create a New Site</h2>
                    
                    <div className="mb-6 flex space-x-4">
                        <button 
                            onClick={() => setMode('query')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'query' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Describe Business
                        </button>
                        <button 
                            onClick={() => setMode('url')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'url' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            Import from URL
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {mode === 'query' ? 'Business Description & Name' : 'Website URL'}
                            </label>
                            <textarea
                                required
                                rows={mode === 'query' ? 4 : 1}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3 dark:bg-gray-700 dark:text-white"
                                placeholder={mode === 'query' ? "e.g., 'Joe's Pizza, a family-owned Italian restaurant in NYC with red and white branding.'" : "https://example.com"}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Logo (Optional)</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                                <div className="space-y-1 text-center">
                                    {logo ? (
                                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                                            {logo.name}
                                            <button type="button" onClick={() => setLogo(null)} className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-400">Remove</button>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                            <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus-within:outline-none">
                                                    <span>Upload a file</span>
                                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => setLogo(e.target.files[0])} accept="image/*" />
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Generate Site
                        </button>
                    </form>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Builder;
