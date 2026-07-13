const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

let _client = null;
function razorpay() {
    if (_client) return _client;
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
        throw new Error('Razorpay not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }
    _client = new Razorpay({ key_id, key_secret });
    return _client;
}

async function createOrder(amount, currency = 'INR', receipt) {
    const options = { amount, currency, receipt };
    return razorpay().orders.create(options);
}

function verifyPayment(orderId, paymentId, signature) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error('RAZORPAY_KEY_SECRET not set');
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(orderId + '|' + paymentId)
        .digest('hex');
    return generatedSignature === signature;
}

module.exports = { createOrder, verifyPayment };
