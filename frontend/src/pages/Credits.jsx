import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useCredits } from '../context/CreditsContext';
import BuyCreditsModal from '../components/BuyCreditsModal';

const Credits = () => {
    const { credits, loading: creditsLoading, fetchCredits } = useCredits();
    const [transactions, setTransactions] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get('/api/credits/history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(response.data);
        } catch (error) {
            console.error('Failed to fetch transaction history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Credits & Billing</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your credits and view transaction history.</p>
                </div>
            </div>

            {/* Balance Card */}
            <div className="bg-white dark:bg-[#1a192b] rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-500">
                            <span className="material-symbols-outlined text-[32px]">account_balance_wallet</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Balance</p>
                            {creditsLoading ? (
                                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1"></div>
                            ) : (
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {credits.toLocaleString()}
                                    <span className="text-lg font-normal text-slate-500">Credits</span>
                                </h2>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsBuyModalOpen(true)}
                        className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Top Up Wallet
                    </button>
                </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white dark:bg-[#1a192b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">history</span>
                        Transaction History
                    </h3>
                    <button 
                        onClick={fetchHistory} 
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Refresh"
                    >
                        <span className={`material-symbols-outlined ${loadingHistory ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loadingHistory ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto animate-pulse"></div></td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">receipt_long</span>
                                            <p>No transactions found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full flex items-center justify-center ${
                                                    tx.type === 'credit' 
                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                                    : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                }`}>
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {tx.type === 'credit' ? 'add' : 'remove'}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-slate-700 dark:text-slate-200">{tx.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {formatDate(tx.createdAt)}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${
                                            tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'
                                        }`}>
                                            {tx.type === 'credit' ? '+' : ''}{tx.amount}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <BuyCreditsModal 
                isOpen={isBuyModalOpen} 
                onClose={() => {
                    setIsBuyModalOpen(false);
                    // Refresh history after closing modal (assuming successful purchase)
                    fetchCredits();
                    fetchHistory();
                }} 
            />
        </div>
    );
};

export default Credits;
