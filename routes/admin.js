const express = require('express');
const router = express.Router();
const verifyAdmin = require('../middleware/adminAuth');
const { db, admin, auth } = require('../services/firebase');
const { getUserCredits, addCredits } = require('../services/credits');

// All routes use admin middleware
router.use(verifyAdmin);

// --- Dashboard Stats ---
router.get('/stats', async (req, res) => {
    try {
        // Parallel queries
        const [usersSnap, projectsSnap, transactionsSnap, tokenUsageSnap] = await Promise.all([
            db.collection('users').get(),
            db.collection('projects').get(),
            db.collection('transactions').where('type', '==', 'credit').get(),
            db.collection('tokenUsage').orderBy('createdAt', 'desc').limit(1000).get()
        ]);

        const totalUsers = usersSnap.size;
        const totalSites = projectsSnap.size;
        const publishedSites = projectsSnap.docs.filter(d => d.data().isPublished).length;
        const failedSites = projectsSnap.docs.filter(d => d.data().status === 'failed').length;
        const failureRate = totalSites > 0 ? ((failedSites / totalSites) * 100).toFixed(1) : 0;

        // Revenue: sum of credit purchase amounts
        let totalRevenue = 0;
        transactionsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.description && d.description.includes('Purchased')) {
                // Extract INR amount from description like "Purchased 500 credits for ₹99"
                const match = d.description.match(/₹(\d+)/);
                if (match) totalRevenue += parseInt(match[1]);
            }
        });

        // Token usage totals
        let totalTokens = 0;
        tokenUsageSnap.docs.forEach(doc => {
            totalTokens += doc.data().totalTokens || 0;
        });

        const avgTokensPerSite = totalSites > 0 ? Math.round(totalTokens / totalSites) : 0;

        res.json({
            totalUsers,
            totalSites,
            publishedSites,
            totalRevenue,
            totalTokens,
            avgTokensPerSite,
            failureRate: parseFloat(failureRate)
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// --- Users ---
router.get('/users', async (req, res) => {
    try {
        const { search, limit = 50, pageToken } = req.query;
        const maxResults = Math.min(parseInt(limit) || 50, 100);

        // List users from Firebase Auth
        const listResult = await auth.listUsers(maxResults, pageToken || undefined);

        // Get Firestore user data for credits
        const uids = listResult.users.map(u => u.uid);
        const userDocs = {};
        // Firestore 'in' queries limited to 30
        for (let i = 0; i < uids.length; i += 30) {
            const chunk = uids.slice(i, i + 30);
            const snap = await db.collection('users').where('__name__', 'in', chunk).get();
            snap.docs.forEach(d => { userDocs[d.id] = d.data(); });
        }

        // Get project counts per user
        const projectCounts = {};
        for (let i = 0; i < uids.length; i += 30) {
            const chunk = uids.slice(i, i + 30);
            const snap = await db.collection('projects').where('userId', 'in', chunk).get();
            snap.docs.forEach(d => {
                const uid = d.data().userId;
                projectCounts[uid] = (projectCounts[uid] || 0) + 1;
            });
        }

        let users = listResult.users.map(u => ({
            uid: u.uid,
            email: u.email || null,
            phoneNumber: u.phoneNumber || null,
            displayName: u.displayName || userDocs[u.uid]?.name || null,
            credits: userDocs[u.uid]?.credits || 0,
            sitesCount: projectCounts[u.uid] || 0,
            createdAt: u.metadata.creationTime,
            lastSignIn: u.metadata.lastSignInTime,
            disabled: u.disabled,
            referralCode: userDocs[u.uid]?.referralCode || null
        }));

        // Client-side search filter
        if (search) {
            const s = search.toLowerCase();
            users = users.filter(u =>
                (u.email && u.email.toLowerCase().includes(s)) ||
                (u.phoneNumber && u.phoneNumber.includes(s)) ||
                (u.displayName && u.displayName.toLowerCase().includes(s)) ||
                u.uid.includes(s)
            );
        }

        res.json({
            users,
            nextPageToken: listResult.pageToken || null
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// --- User Detail ---
router.get('/users/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        const [userRecord, userDoc, projectsSnap, transactionsSnap, domainsSnap] = await Promise.all([
            auth.getUser(uid),
            db.collection('users').doc(uid).get(),
            db.collection('projects').where('userId', '==', uid).get(),
            db.collection('transactions').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(50).get(),
            db.collection('domains').where('userId', '==', uid).get()
        ]);

        const userData = userDoc.exists ? userDoc.data() : {};

        res.json({
            uid: userRecord.uid,
            email: userRecord.email,
            phoneNumber: userRecord.phoneNumber,
            displayName: userRecord.displayName || userData.name,
            credits: userData.credits || 0,
            referralCode: userData.referralCode || null,
            setupComplete: userData.setupComplete || false,
            createdAt: userRecord.metadata.creationTime,
            lastSignIn: userRecord.metadata.lastSignInTime,
            projects: projectsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            transactions: transactionsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate() || null
            })),
            domains: domainsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });
    } catch (error) {
        console.error('Admin user detail error:', error);
        res.status(500).json({ error: 'Failed to fetch user detail' });
    }
});

// --- Add Credits to User ---
router.post('/users/:uid/credits', async (req, res) => {
    try {
        const { uid } = req.params;
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount required' });
        }

        await addCredits(uid, parseInt(amount), description || `Admin credit grant by ${req.user.uid}`);
        const newBalance = await getUserCredits(uid);

        res.json({ success: true, newBalance });
    } catch (error) {
        console.error('Admin add credits error:', error);
        res.status(500).json({ error: 'Failed to add credits' });
    }
});

// --- Projects ---
router.get('/projects', async (req, res) => {
    try {
        const { status, userId, limit = 50 } = req.query;
        let query = db.collection('projects').orderBy('createdAt', 'desc');

        if (status) query = query.where('status', '==', status);
        if (userId) query = query.where('userId', '==', userId);
        query = query.limit(parseInt(limit) || 50);

        const snap = await query.get();
        const projects = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() || null,
            completedAt: d.data().completedAt?.toDate() || null
        }));

        res.json({ projects });
    } catch (error) {
        console.error('Admin projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// --- Transactions ---
router.get('/transactions', async (req, res) => {
    try {
        const { userId, type, limit = 50 } = req.query;
        let query = db.collection('transactions').orderBy('createdAt', 'desc');

        if (userId) query = query.where('userId', '==', userId);
        if (type) query = query.where('type', '==', type);
        query = query.limit(parseInt(limit) || 50);

        const snap = await query.get();
        const transactions = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() || null
        }));

        res.json({ transactions });
    } catch (error) {
        console.error('Admin transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// --- Token Usage ---
router.get('/token-usage', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const snap = await db.collection('tokenUsage')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(since))
            .orderBy('createdAt', 'desc')
            .get();

        let totalInput = 0, totalOutput = 0, totalTokens = 0;
        const byService = {};
        const byModel = {};

        snap.docs.forEach(d => {
            const data = d.data();
            totalInput += data.inputTokens || 0;
            totalOutput += data.outputTokens || 0;
            totalTokens += data.totalTokens || 0;

            const svc = data.service || 'unknown';
            if (!byService[svc]) byService[svc] = { input: 0, output: 0, total: 0, count: 0 };
            byService[svc].input += data.inputTokens || 0;
            byService[svc].output += data.outputTokens || 0;
            byService[svc].total += data.totalTokens || 0;
            byService[svc].count += 1;

            const mdl = data.model || 'gemini';
            if (!byModel[mdl]) byModel[mdl] = { input: 0, output: 0, total: 0, count: 0 };
            byModel[mdl].input += data.inputTokens || 0;
            byModel[mdl].output += data.outputTokens || 0;
            byModel[mdl].total += data.totalTokens || 0;
            byModel[mdl].count += 1;
        });

        // Estimate cost (rough: $0.075/1M input, $0.30/1M output for Flash)
        const estimatedCost = (totalInput * 0.000000075) + (totalOutput * 0.0000003);

        res.json({
            totalInput,
            totalOutput,
            totalTokens,
            totalCalls: snap.size,
            estimatedCost: parseFloat(estimatedCost.toFixed(4)),
            byService,
            byModel,
            days: parseInt(days)
        });
    } catch (error) {
        console.error('Admin token usage error:', error);
        res.status(500).json({ error: 'Failed to fetch token usage' });
    }
});

// --- Referrals ---
router.get('/referrals', async (req, res) => {
    try {
        const { status } = req.query;
        let query = db.collection('referrals').orderBy('createdAt', 'desc');
        if (status) query = query.where('status', '==', status);

        const snap = await query.get();
        const referrals = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() || null,
            completedAt: d.data().completedAt?.toDate() || null
        }));

        res.json({ referrals });
    } catch (error) {
        console.error('Admin referrals error:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

// --- Platform Config ---
router.get('/config', async (req, res) => {
    try {
        const doc = await db.collection('platformConfig').doc('general').get();
        const defaults = {
            signupGiftCredits: 200,
            referralEnabled: true,
            referralRewardAmount: 100,
            referralBonusAmount: 50
        };
        res.json(doc.exists ? { ...defaults, ...doc.data() } : defaults);
    } catch (error) {
        console.error('Admin config error:', error);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const updates = req.body;
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.updatedBy = req.user.uid;

        await db.collection('platformConfig').doc('general').set(updates, { merge: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Admin config update error:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

module.exports = router;
