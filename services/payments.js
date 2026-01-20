const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

console.log('Razorpay Init - ID:', process.env.RAZORPAY_KEY_ID ? 'Exists' : 'Missing');
console.log('Razorpay Init - Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Exists' : 'Missing');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function createOrder(amount, currency = 'INR', receipt) {
    try {
        const options = {
            amount: amount, // Amount in smallest currency unit (e.g., paise)
            currency: currency,
            receipt: receipt
        };
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error('Razorpay Create Order Error:', error);
        throw error;
    }
}

function verifyPayment(orderId, paymentId, signature) {
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + "|" + paymentId)
        .digest('hex');

    if (generatedSignature === signature) {
        return true;
    } else {
        return false;
    }
}

module.exports = { createOrder, verifyPayment };
