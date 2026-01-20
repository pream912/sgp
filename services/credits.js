const { db, admin } = require('./firebase');

// Get User Credits
async function getUserCredits(userId) {
    if (!db) return 0; // Fallback if DB not connected
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            // Initialize user if not exists
            await db.collection('users').doc(userId).set({ credits: 0 }, { merge: true });
            return 0;
        }
        return userDoc.data().credits || 0;
    } catch (error) {
        console.error('Error getting credits:', error);
        throw error;
    }
}

// Add Credits
async function addCredits(userId, amount, description, transactionId = null) {
    if (!db) return;

    const userRef = db.collection('users').doc(userId);
    
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            const currentCredits = doc.exists ? (doc.data().credits || 0) : 0;
            const newBalance = currentCredits + amount;
            
            t.set(userRef, { credits: newBalance }, { merge: true });
            
            // Log transaction
            const transactionRef = db.collection('transactions').doc();
            t.set(transactionRef, {
                userId,
                amount,
                type: 'credit',
                description,
                balanceAfter: newBalance,
                transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        console.log(`Added ${amount} credits to user ${userId}`);
    } catch (error) {
        console.error('Error adding credits:', error);
        throw error;
    }
}

// Deduct Credits
async function deductCredits(userId, amount, description) {
    if (!db) return true; // Dev mode / No DB -> Free

    const userRef = db.collection('users').doc(userId);
    
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            const currentCredits = doc.exists ? (doc.data().credits || 0) : 0;
            
            if (currentCredits < amount) {
                throw new Error('Insufficient credits');
            }
            
            const newBalance = currentCredits - amount;
            
            t.update(userRef, { credits: newBalance });
            
            // Log transaction
            const transactionRef = db.collection('transactions').doc();
            t.set(transactionRef, {
                userId,
                amount: -amount,
                type: 'debit',
                description,
                balanceAfter: newBalance,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        console.log(`Deducted ${amount} credits from user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error deducting credits:', error);
        throw error;
    }
}

module.exports = { getUserCredits, addCredits, deductCredits };
