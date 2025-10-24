const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.options('*', cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from root directory (where instamojo.html is located)
app.use(express.static(__dirname));

// ============ INSTAMOJO CONFIGURATION ============
const INSTAMOJO_CONFIG = {
    apiKey: process.env.INSTAMOJO_API_KEY,
    authToken: process.env.INSTAMOJO_AUTH_TOKEN,
    salt: process.env.INSTAMOJO_SALT,
    // Fix: Use v1.1 API for standard Instamojo accounts
    apiUrl: process.env.INSTAMOJO_API_URL || 'https://api.instamojo.com/v2/',
    testMode: process.env.TEST_MODE === 'true' || (!process.env.INSTAMOJO_API_KEY || !process.env.INSTAMOJO_AUTH_TOKEN)
};

console.log('🔑 Instamojo Configuration:');
console.log('   API Key:', INSTAMOJO_CONFIG.apiKey ? '✓ Set' : '✗ Missing');
console.log('   Auth Token:', INSTAMOJO_CONFIG.authToken ? '✓ Set' : '✗ Missing');
console.log('   Salt:', INSTAMOJO_CONFIG.salt ? '✓ Set' : '✗ Missing');
console.log('   API URL:', INSTAMOJO_CONFIG.apiUrl);
console.log('   Test Mode:', INSTAMOJO_CONFIG.testMode ? '✓ ENABLED (Mock Payments)' : '✗ DISABLED (Real Payments)');

if (INSTAMOJO_CONFIG.testMode) {
    console.log('⚠️  WARNING: Running in TEST MODE - No real payments will be processed');
    console.log('   To enable real payments, add credentials to .env file');
}

// Email Configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Verify email configuration
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    emailTransporter.verify((error, success) => {
        if (error) {
            console.log('❌ Email configuration error:', error.message);
        } else {
            console.log('✅ Email server ready');
        }
    });
} else {
    console.log('⚠️  Email not configured (optional for testing)');
}

// In-memory storage (Use MongoDB/PostgreSQL in production)
const paymentStore = new Map();
const enquiryStore = new Map();

// ============ UTILITY FUNCTIONS ============
function generateOrderId() {
    return 'ZUDIO_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateMAC(data, salt) {
    const message = data.join('|');
    const mac = crypto.createHmac('sha1', salt).update(message).digest('hex');
    return mac;
}

async function sendEmail(to, subject, htmlContent) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.log('⚠️  Email not configured - skipping email to:', to);
        return false;
    }
    
    try {
        const mailOptions = {
            from: `"Zudio Franchise" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            // Force HTML rendering
            headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                'MIME-Version': '1.0'
            }
        };
        
        await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent to:', to);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
    }
}

// ============ INSTAMOJO PAYMENT FUNCTIONS ============
async function createInstamojoPaymentRequest(paymentData, customerData, orderId) {
    try {
        // TEST MODE: Return mock response
        if (INSTAMOJO_CONFIG.testMode) {
            console.log('⚠️  TEST MODE: Returning mock payment link');
            const mockId = 'TEST_' + crypto.randomBytes(8).toString('hex');
            return {
                success: true,
                data: {
                    id: mockId,
                    longurl: `http://localhost:3000/test-payment?payment_id=${mockId}&payment_request_id=${orderId}&amount=${paymentData.amount}&buyer_name=${encodeURIComponent(customerData.name)}`,
                    shorturl: `http://localhost:3000/pay/${mockId}`
                }
            };
        }

        // Validate credentials
        if (!INSTAMOJO_CONFIG.apiKey || !INSTAMOJO_CONFIG.authToken) {
            throw new Error('Instamojo credentials not configured. Set TEST_MODE=true in .env or add valid credentials.');
        }

        // Validate API URL
        if (!INSTAMOJO_CONFIG.apiUrl) {
            throw new Error('Instamojo API URL not configured.');
        }

        const payload = {
            purpose: paymentData.purpose || 'Zudio Franchise Registration',
            amount: paymentData.amount,
            buyer_name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            redirect_url: process.env.REDIRECT_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/payment-success`,
            webhook: process.env.WEBHOOK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/webhook`,
            send_email: true,
            send_sms: false,
            allow_repeated_payments: false
        };

        console.log('📤 Creating Instamojo payment request');
        console.log('   API URL:', INSTAMOJO_CONFIG.apiUrl);
        console.log('   Purpose:', payload.purpose);
        console.log('   Amount:', payload.amount);
        console.log('   Customer:', payload.buyer_name);
        console.log('   Redirect URL:', payload.redirect_url);
        console.log('   Webhook URL:', payload.webhook);

        const response = await axios.post(
            `${INSTAMOJO_CONFIG.apiUrl}payment-requests/`,
            payload,
            {
                headers: {
                    'X-Api-Key': INSTAMOJO_CONFIG.apiKey,
                    'X-Auth-Token': INSTAMOJO_CONFIG.authToken,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            }
        );

        if (response.data.success) {
            console.log('✅ Instamojo payment request created successfully');
            console.log('   Payment Request ID:', response.data.payment_request.id);
            console.log('   Long URL:', response.data.payment_request.longurl);
            return {
                success: true,
                data: response.data.payment_request
            };
        } else {
            console.error('❌ Instamojo returned unsuccessful response:', response.data);
            throw new Error('Failed to create payment request');
        }
    } catch (error) {
        console.error('❌ Instamojo API Error:');
        
        // Handle different types of errors
        if (error.code === 'ENOTFOUND') {
            console.error('   DNS Error: Cannot resolve', error.hostname);
            console.error('   💡 Solution: Set TEST_MODE=true in .env file');
            throw new Error('Cannot connect to Instamojo API. Enable TEST_MODE in .env for testing.');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            console.error('   Timeout Error: Connection timed out');
            throw new Error('Connection to Instamojo timed out. Please try again.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('   Connection Refused');
            throw new Error('Cannot connect to Instamojo. Check API URL.');
        } else if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
            
            // Handle specific Instamojo errors
            if (error.response.status === 401) {
                throw new Error('Invalid Instamojo credentials. Check your API Key and Auth Token.');
            } else if (error.response.status === 400) {
                const errorMsg = error.response.data?.message || 'Invalid payment request data';
                throw new Error(errorMsg);
            }
            throw new Error(error.response.data?.message || 'Instamojo API error');
        } else {
            console.error('   Message:', error.message);
            throw error;
        }
    }
}

async function verifyInstamojoPayment(paymentId, paymentRequestId) {
    try {
        if (INSTAMOJO_CONFIG.testMode) {
            return {
                success: true,
                data: { status: 'Credit' }
            };
        }

        const response = await axios.get(
            `${INSTAMOJO_CONFIG.apiUrl}payment-requests/${paymentRequestId}/${paymentId}/`,
            {
                headers: {
                    'X-Api-Key': INSTAMOJO_CONFIG.apiKey,
                    'X-Auth-Token': INSTAMOJO_CONFIG.authToken
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Payment verified successfully');
            return {
                success: true,
                data: response.data.payment_request
            };
        }
        return { success: false };
    } catch (error) {
        console.error('❌ Payment verification error:', error.message);
        return { success: false, error: error.message };
    }
}

function verifyWebhookMAC(data, receivedMAC) {
    if (!INSTAMOJO_CONFIG.salt) {
        console.warn('⚠️  No salt configured - skipping MAC verification');
        return true; // Allow in test mode
    }

    const fields = ['payment_id', 'payment_request_id', 'status'];
    const values = fields.map(field => data[field] || '');
    const calculatedMAC = generateMAC(values, INSTAMOJO_CONFIG.salt);
    
    const isValid = calculatedMAC === receivedMAC;
    console.log('🔐 MAC Verification:', isValid ? '✓ Valid' : '✗ Invalid');
    
    return isValid;
}

// ============ ROUTES ============

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
        instamojo: {
            configured: !!(INSTAMOJO_CONFIG.apiKey && INSTAMOJO_CONFIG.authToken),
            testMode: INSTAMOJO_CONFIG.testMode,
            apiUrl: INSTAMOJO_CONFIG.apiUrl
        }
    });
});

// Root Route - Serve instamojo.html specifically
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'instamojo.html');
    if (require('fs').existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send(`
            <h1>Error: instamojo.html not found</h1>
            <p>Please make sure instamojo.html exists in the project folder: ${__dirname}</p>
            <p>Current files in directory: ${require('fs').readdirSync(__dirname).join(', ')}</p>
        `);
    }
});

// CREATE PAYMENT REQUEST
app.post('/api/create-payment', async (req, res) => {
    try {
        const { paymentData, customerData } = req.body;

        console.log('\n📦 New Payment Request Received');
        console.log('   Customer:', customerData.name);
        console.log('   Amount:', paymentData.amount);

        // Validate
        if (!paymentData || !customerData) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment or customer data'
            });
        }

        if (!paymentData.amount || isNaN(paymentData.amount) || paymentData.amount < 9) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment amount (minimum ₹9 required by Instamojo)'
            });
        }

        if (!customerData.name || !customerData.email || !customerData.phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required customer information (name, email, phone)'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerData.email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Phone validation (10 digits)
        const phoneRegex = /^\d{10}$/;
        const cleanPhone = customerData.phone.replace(/\D/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number (must be 10 digits)'
            });
        }

        // Generate Order ID
        const orderId = generateOrderId();

        // Create Instamojo Payment Request
        const instamojoResponse = await createInstamojoPaymentRequest(
            paymentData,
            customerData,
            orderId
        );

        if (!instamojoResponse.success) {
            throw new Error('Failed to create payment request with Instamojo');
        }

        const paymentRequest = instamojoResponse.data;

        // Store payment data
        const paymentRecord = {
            orderId: orderId,
            paymentRequestId: paymentRequest.id,
            customerData: customerData,
            paymentData: paymentData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            amount: paymentData.amount,
            purpose: paymentData.purpose,
            longurl: paymentRequest.longurl,
            shorturl: paymentRequest.shorturl
        };

        paymentStore.set(orderId, paymentRecord);

        console.log('✅ Payment request created successfully');
        console.log('   Order ID:', orderId);
        console.log('   Payment URL:', paymentRequest.longurl);

        // Send confirmation email to customer
        const customerEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #000; color: white; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 32px; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .button { display: inline-block; padding: 15px 40px; background: #000; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                    .details { background: white; padding: 20px; border-left: 4px solid #000; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; }
                    .payment-link { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
                    .test-mode-badge { background: #ff6b6b; color: white; padding: 8px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>ZUDIO FRANCHISE</h1>
                    </div>
                    <div class="content">
                        ${INSTAMOJO_CONFIG.testMode ? '<div style="text-align: center;"><span class="test-mode-badge">🧪 TEST MODE - DEMO PAYMENT</span></div>' : ''}
                        <h2>Complete Your Payment</h2>
                        <p>Hi ${customerData.name},</p>
                        <p>Your Zudio franchise registration payment request has been created successfully.</p>
                        
                        <div class="details">
                            <strong>Order Details:</strong><br>
                            <strong>Order ID:</strong> ${orderId}<br>
                            <strong>Amount:</strong> ₹${paymentData.amount}<br>
                            <strong>Purpose:</strong> ${paymentData.purpose}<br>
                            <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}
                        </div>

                        <p><strong>Complete your payment by clicking the button below:</strong></p>
                        <p style="text-align: center;">
                            <a href="${paymentRequest.longurl}" class="button" style="color: white !important;">PAY NOW - ₹${paymentData.amount}</a>
                        </p>
                        
                        <div class="payment-link">
                            <strong>📎 Payment Link:</strong><br>
                            <a href="${paymentRequest.longurl}" style="color: #0066cc; text-decoration: none;">${paymentRequest.longurl}</a>
                        </div>

                        ${INSTAMOJO_CONFIG.testMode ? '<p style="background: #fff3cd; padding: 15px; border-radius: 8px; font-size: 14px;"><strong>⚠️ Note:</strong> This is a test/demo payment link. In production mode, this will redirect to the actual Instamojo payment gateway.</p>' : '<p><strong>⏰ Important:</strong> This payment link is valid for 24 hours.</p>'}

                        <p>After successful payment, our team will contact you within 24 hours to proceed with your franchise application.</p>
                        
                        <div class="footer">
                            <p><strong>Contact Information:</strong></p>
                            <p>Email: franchise@zudio.com<br>
                            Phone: +91 22 6619 7000</p>
                            <p style="margin-top: 20px; font-size: 12px;">
                                © 2025 Zudio (Trent Ltd.). Part of the Tata Group.<br>
                                All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        await sendEmail(customerData.email, `${INSTAMOJO_CONFIG.testMode ? '[TEST] ' : ''}Complete Your Zudio Franchise Payment`, customerEmailHtml);

        // Send admin notification
        if (process.env.EMAIL_USER) {
            const adminEmailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                        .header { background: #000; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                        .content { background: #f9f9f9; padding: 25px; border-radius: 0 0 8px 8px; }
                        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #000; }
                        .payment-link-box { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
                        .test-badge { background: #ff6b6b; color: white; padding: 5px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; display: inline-block; }
                        table { width: 100%; border-collapse: collapse; }
                        td { padding: 8px 0; }
                        td:first-child { font-weight: bold; width: 40%; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="margin: 0;">🔔 New Payment Request - Zudio Franchise</h2>
                            ${INSTAMOJO_CONFIG.testMode ? '<p style="margin: 10px 0 0 0;"><span class="test-badge">TEST MODE</span></p>' : ''}
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <h3 style="margin-top: 0; color: #000;">👤 Customer Details</h3>
                                <table>
                                    <tr><td>Name:</td><td>${customerData.name}</td></tr>
                                    <tr><td>Email:</td><td>${customerData.email}</td></tr>
                                    <tr><td>Phone:</td><td>${customerData.phone}</td></tr>
                                    <tr><td>City:</td><td>${customerData.city}</td></tr>
                                    <tr><td>Package:</td><td>${customerData.packageType}</td></tr>
                                </table>
                            </div>
                            
                            <div class="info-box">
                                <h3 style="margin-top: 0; color: #000;">💰 Payment Details</h3>
                                <table>
                                    <tr><td>Amount:</td><td><strong style="color: #28a745; font-size: 18px;">₹${paymentData.amount}</strong></td></tr>
                                    <tr><td>Order ID:</td><td>${orderId}</td></tr>
                                    <tr><td>Payment Request ID:</td><td>${paymentRequest.id}</td></tr>
                                    <tr><td>Status:</td><td><span style="background: #ffc107; color: #000; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">PENDING</span></td></tr>
                                    <tr><td>Created At:</td><td>${new Date().toLocaleString('en-IN')}</td></tr>
                                </table>
                            </div>
                            
                            <div class="payment-link-box">
                                <h3 style="margin-top: 0; color: #000;">🔗 Customer Payment Link</h3>
                                <p style="margin: 10px 0;"><strong>Long URL:</strong></p>
                                <p style="margin: 5px 0;"><a href="${paymentRequest.longurl}" style="color: #0066cc; word-break: break-all;">${paymentRequest.longurl}</a></p>
                                
                                ${paymentRequest.shorturl ? `
                                <p style="margin: 15px 0 5px 0;"><strong>Short URL:</strong></p>
                                <p style="margin: 5px 0;"><a href="${paymentRequest.shorturl}" style="color: #0066cc;">${paymentRequest.shorturl}</a></p>
                                ` : ''}
                            </div>

                            ${INSTAMOJO_CONFIG.testMode ? `
                            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #1976d2;"><strong>ℹ️ Test Mode Active:</strong> This is a demo payment link. No real transaction will occur.</p>
                            </div>
                            ` : `
                            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #856404;"><strong>⏰ Action Required:</strong> Monitor this payment and follow up with customer after completion.</p>
                            </div>
                            `}
                            
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
                                <p style="margin: 5px 0; font-size: 14px; color: #666;">
                                    <strong>Quick Links:</strong><br>
                                    <a href="http://localhost:3000/api/admin/payments" style="color: #0066cc; margin: 0 10px;">View All Payments</a> | 
                                    <a href="http://localhost:3000/api/payment-status/${orderId}" style="color: #0066cc; margin: 0 10px;">Check Status</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await sendEmail(process.env.EMAIL_USER, `${INSTAMOJO_CONFIG.testMode ? '[TEST] ' : ''}🔔 New Payment Request - Zudio (₹${paymentData.amount})`, adminEmailHtml);
        }

        // Return response
        res.status(201).json({
            success: true,
            message: 'Payment request created successfully',
            data: {
                orderId: orderId,
                paymentRequestId: paymentRequest.id,
                amount: paymentData.amount,
                longurl: paymentRequest.longurl,
                shorturl: paymentRequest.shorturl,
                status: 'pending',
                testMode: INSTAMOJO_CONFIG.testMode
            }
        });

    } catch (error) {
        console.error('❌ Payment creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment request',
            error: error.message,
            details: error.response?.data
        });
    }
});

// INSTAMOJO WEBHOOK
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('\n🔔 Webhook received from Instamojo');
        console.log('   Headers:', req.headers);
        console.log('   Body:', req.body);

        const { payment_id, payment_request_id, status, mac } = req.body;

        // Verify MAC if salt is configured
        if (INSTAMOJO_CONFIG.salt && mac) {
            const isValid = verifyWebhookMAC(req.body, mac);
            if (!isValid) {
                console.error('❌ Invalid MAC - webhook rejected');
                return res.status(400).send('Invalid MAC');
            }
        }

        if (status === 'Credit') {
            console.log('✅ Payment successful - Status: Credit');
            
            // Find order by payment_request_id
            let foundOrder = null;
            for (const [orderId, data] of paymentStore.entries()) {
                if (data.paymentRequestId === payment_request_id) {
                    foundOrder = { orderId, ...data };
                    break;
                }
            }

            if (foundOrder) {
                // Update payment status
                foundOrder.status = 'completed';
                foundOrder.paymentId = payment_id;
                foundOrder.completedAt = new Date().toISOString();
                paymentStore.set(foundOrder.orderId, foundOrder);

                console.log('✅ Payment marked as completed');
                console.log('   Order ID:', foundOrder.orderId);
                console.log('   Payment ID:', payment_id);

                // Send success email
                const successEmailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #28a745; color: white; padding: 30px; text-align: center; }
                            .header h1 { margin: 0; font-size: 32px; }
                            .content { padding: 30px; background: #f9f9f9; }
                            .success { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; }
                            .details { background: white; padding: 20px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>✓ PAYMENT SUCCESSFUL</h1>
                            </div>
                            <div class="content">
                                <h2>Thank You for Your Payment!</h2>
                                <p>Hi ${foundOrder.customerData.name},</p>
                                
                                <div class="success">
                                    <strong>✓ Your payment has been received successfully!</strong>
                                </div>

                                <div class="details">
                                    <p><strong>Payment Details:</strong></p>
                                    <ul>
                                        <li><strong>Order ID:</strong> ${foundOrder.orderId}</li>
                                        <li><strong>Payment ID:</strong> ${payment_id}</li>
                                        <li><strong>Amount:</strong> ₹${foundOrder.amount}</li>
                                        <li><strong>Status:</strong> <span style="color: green; font-weight: bold;">COMPLETED</span></li>
                                        <li><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</li>
                                    </ul>
                                </div>

                                <h3>Next Steps:</h3>
                                <ol>
                                    <li>Our franchise team will review your application</li>
                                    <li>We'll contact you within 24 hours</li>
                                    <li>Site selection assistance will be provided</li>
                                    <li>Franchise agreement preparation</li>
                                    <li>Training and onboarding</li>
                                </ol>

                                <p style="margin-top: 30px;"><strong>Contact Information:</strong><br>
                                Email: franchise@zudio.com<br>
                                Phone: +91 22 6619 7000</p>

                                <p style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
                                    © 2025 Zudio (Trent Ltd.). Part of the Tata Group. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await sendEmail(foundOrder.customerData.email, '✓ Payment Successful - Zudio Franchise', successEmailHtml);

                // Notify admin
                if (process.env.EMAIL_USER) {
                    const adminNotificationHtml = `
                        <h2 style="color: green;">✓ Payment Completed - Zudio Franchise</h2>
                        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>✓ PAYMENT SUCCESSFULLY COMPLETED</strong></p>
                        </div>
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
                            <p><strong>Customer:</strong> ${foundOrder.customerData.name}</p>
                            <p><strong>Email:</strong> ${foundOrder.customerData.email}</p>
                            <p><strong>Phone:</strong> ${foundOrder.customerData.phone}</p>
                            <p><strong>Order ID:</strong> ${foundOrder.orderId}</p>
                            <p><strong>Payment ID:</strong> ${payment_id}</p>
                            <p><strong>Amount:</strong> ₹${foundOrder.amount}</p>
                            <p><strong>Status:</strong> <span style="color: green; font-weight: bold;">COMPLETED</span></p>
                            <p><strong>Completed At:</strong> ${new Date().toLocaleString('en-IN')}</p>
                        </div>
                        <hr style="margin: 30px 0;">
                        <p><strong>⚠️  Action Required:</strong> Follow up with customer within 24 hours.</p>
                    `;

                    await sendEmail(process.env.EMAIL_USER, '✓ Payment Completed - Zudio', adminNotificationHtml);
                }
            } else {
                console.warn('⚠️  Order not found for payment_request_id:', payment_request_id);
            }
        } else {
            console.log('ℹ️  Payment status:', status);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error');
    }
});

// TEST PAYMENT PAGE (simulates Instamojo)
app.get('/test-payment', (req, res) => {
    const { payment_id, payment_request_id, amount, buyer_name } = req.query;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Payment Gateway - Zudio Franchise</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { font-size: 24px; margin-bottom: 10px; }
                .test-badge { background: #ff6b6b; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; display: inline-block; margin-top: 10px; }
                .content { padding: 40px; }
                .amount { font-size: 48px; font-weight: bold; color: #333; text-align: center; margin: 20px 0; }
                .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .details p { margin: 10px 0; color: #666; }
                .details strong { color: #333; }
                .button { display: block; width: 100%; padding: 18px; background: #28a745; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; margin: 10px 0; border: none; cursor: pointer; transition: background 0.3s; }
                .button:hover { background: #218838; }
                .button-secondary { background: #dc3545; }
                .button-secondary:hover { background: #c82333; }
                .info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #1976d2; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🧪 Test Payment Gateway</h1>
                    <span class="test-badge">DEMO MODE - NO REAL PAYMENT</span>
                </div>
                <div class="content">
                    <div class="amount">₹${amount || '0'}</div>
                    
                    <div class="details">
                        <p><strong>Merchant:</strong> Zudio Franchise</p>
                        <p><strong>Buyer:</strong> ${decodeURIComponent(buyer_name || 'Customer')}</p>
                        <p><strong>Payment ID:</strong> ${payment_id}</p>
                        <p><strong>Order ID:</strong> ${payment_request_id}</p>
                    </div>

                    <div class="info">
                        <strong>ℹ️ This is a test payment page.</strong><br>
                        In production mode, you would be redirected to the actual Instamojo payment gateway where you can pay using UPI, Cards, Net Banking, or Wallets.
                    </div>

                    <button class="button" onclick="completePayment()">✓ Simulate Successful Payment</button>
                    <button class="button button-secondary" onclick="failPayment()">✗ Simulate Failed Payment</button>

                    <p style="text-align: center; margin-top: 30px; color: #999; font-size: 14px;">
                        Click either button to simulate the payment outcome
                    </p>
                </div>
            </div>

            <script>
                function completePayment() {
                    const params = new URLSearchParams(window.location.search);
                    const paymentId = params.get('payment_id');
                    const orderId = params.get('payment_request_id');
                    
                    // Simulate webhook call
                    fetch('/api/webhook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payment_id: paymentId,
                            payment_request_id: orderId,
                            status: 'Credit'
                        })
                    });

                    // Redirect to success page
                    setTimeout(() => {
                        window.location.href = '/payment-success?payment_id=' + paymentId + '&payment_request_id=' + orderId + '&status=Credit';
                    }, 500);
                }

                function failPayment() {
                    alert('Payment cancelled/failed (Test Mode)');
                    window.location.href = '/';
                }
            </script>
        </body>
        </html>
    `);
});

// PAYMENT SUCCESS PAGE
app.get('/payment-success', (req, res) => {
    const { payment_id, payment_request_id } = req.query;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Successful - Zudio Franchise</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                .container { background: white; padding: 40px; border-radius: 15px; text-align: center; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                .success-icon { font-size: 80px; color: #28a745; animation: bounce 1s ease; }
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
                h1 { color: #333; margin: 20px 0; font-size: 28px; }
                .details { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left; }
                .details p { margin: 10px 0; color: #666; }
                .details strong { color: #333; }
                .button { display: inline-block; padding: 15px 40px; background: #000; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold; transition: transform 0.3s; }
                .button:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
                .note { color: #666; font-size: 14px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Payment Successful!</h1>
                <p>Thank you for your payment. Your Zudio franchise registration has been received.</p>
                <div class="details">
                    <p><strong>Payment ID:</strong> ${payment_id || 'Processing...'}</p>
                    <p><strong>Request ID:</strong> ${payment_request_id || 'N/A'}</p>
                    <p><strong>Status:</strong> <span style="color: green; font-weight: bold;">COMPLETED</span></p>
                </div>
                <p class="note">A confirmation email has been sent to your registered email address.</p>
                <p class="note">Our team will contact you within 24 hours.</p>
                <a href="/" class="button">Back to Home</a>
            </div>
        </body>
        </html>
    `);
});

// CHECK PAYMENT STATUS
app.get('/api/payment-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const payment = paymentStore.get(orderId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            data: {
                orderId: payment.orderId,
                status: payment.status,
                amount: payment.amount,
                createdAt: payment.createdAt,
                completedAt: payment.completedAt || null,
                paymentId: payment.paymentId || null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payment status'
        });
    }
});

// SEND ENQUIRY
app.post('/api/send-notification', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        if (type === 'enquiry') {
            const enquiryId = generateOrderId();

            enquiryStore.set(enquiryId, {
                ...data,
                enquiryId: enquiryId,
                receivedAt: new Date().toISOString()
            });

            console.log('✅ Enquiry stored:', enquiryId);

            // Send confirmation email
            const confirmationHtml = `
                <h2>Enquiry Received - Zudio Franchise</h2>
                <p>Hi ${data.name},</p>
                <p>Thank you for your interest in Zudio franchise opportunity!</p>
                <p><strong>Enquiry ID:</strong> ${enquiryId}</p>
                <p>Our team will contact you within 24-48 hours.</p>
                <p>Best regards,<br>Zudio Franchise Team</p>
            `;

            await sendEmail(data.email, 'Your Zudio Franchise Enquiry Received', confirmationHtml);

            // Admin notification
            if (process.env.EMAIL_USER) {
                const adminEnquiryHtml = `
                    <h2>New Enquiry - Zudio Franchise</h2>
                    <p><strong>Name:</strong> ${data.name}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    <p><strong>Phone:</strong> ${data.phone}</p>
                    <p><strong>City:</strong> ${data.city}</p>
                    <p><strong>Investment:</strong> ${data.investment}</p>
                    <p><strong>Message:</strong> ${data.message || 'N/A'}</p>
                    <p><strong>Enquiry ID:</strong> ${enquiryId}</p>
                `;

                await sendEmail(process.env.EMAIL_USER, 'New Enquiry - Zudio', adminEnquiryHtml);
            }

            res.status(201).json({
                success: true,
                message: 'Enquiry received successfully',
                enquiryId: enquiryId
            });
        }
    } catch (error) {
        console.error('❌ Notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification'
        });
    }
});

// ADMIN ROUTES
app.get('/api/admin/payments', (req, res) => {
    const payments = Array.from(paymentStore.entries()).map(([orderId, data]) => ({
        orderId,
        ...data
    }));
    res.json({ success: true, count: payments.length, data: payments });
});

app.get('/api/admin/enquiries', (req, res) => {
    const enquiries = Array.from(enquiryStore.entries()).map(([enquiryId, data]) => ({
        enquiryId,
        ...data
    }));
    res.json({ success: true, count: enquiries.length, data: enquiries });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('🚨 Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ZUDIO FRANCHISE SERVER - READY');
    console.log('='.repeat(70));
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`📄 HTML File: instamojo.html`);
    console.log(`💳 Payment Gateway: ${INSTAMOJO_CONFIG.testMode ? 'TEST MODE' : 'LIVE MODE'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER || 'Not configured'}`);
    console.log('='.repeat(70));
    if (INSTAMOJO_CONFIG.testMode) {
        console.log('⚠️  TEST MODE ACTIVE - Mock payments enabled');
    } else {
        console.log('✅ LIVE MODE - Real Instamojo payments');
    }
    console.log('='.repeat(70));
    console.log('\n📌 Important Endpoints:');
    console.log(`   Homepage: GET http://localhost:${PORT}/`);
    console.log(`   Health Check: GET http://localhost:${PORT}/health`);
    console.log(`   Payment API: POST http://localhost:${PORT}/api/create-payment`);
    console.log(`   Webhook: POST http://localhost:${PORT}/api/webhook`);
    console.log(`   Admin Payments: GET http://localhost:${PORT}/api/admin/payments`);
    console.log(`   Admin Enquiries: GET http://localhost:${PORT}/api/admin/enquiries`);
    console.log('='.repeat(70) + '\n');
});