# 🏪 Zudio Franchise - Complete Payment Integration System

A full-stack franchise registration and payment processing system for Zudio (Tata Group's fashion retail brand) with **Instamojo Payment Gateway** in **Test Mode**.

> ⚠️ **Important:** This project is configured to run in **TEST MODE** by default. No real payments will be processed. Perfect for learning, development, and demonstration purposes.

## 🌟 Features

- **Responsive Landing Page** - Modern, mobile-friendly UI with smooth animations
- **Dual Form System** - Quick enquiry form and detailed contact form
- **Instamojo Test Mode Integration** - Simulated payment gateway for safe testing
- **Mock Payment Gateway** - Built-in test payment page that simulates Instamojo
- **Email Notifications** - Automated emails to customers and admins (optional)
- **Payment Tracking** - Real-time payment status monitoring
- **Admin Dashboard** - View all payments and enquiries
- **Zero Cost Testing** - No payment gateway charges during development

## 🚀 Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design with mobile-first approach
- Smooth scroll animations with Intersection Observer
- Modern UI with gradient backgrounds and transitions

### Backend
- Node.js with Express.js
- Instamojo Payment Gateway API
- Nodemailer for email notifications
- In-memory storage (Map) - easily replaceable with MongoDB/PostgreSQL

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Gmail account (optional - for email notifications)

> 💡 **No Instamojo account needed for test mode!** The project works out of the box with simulated payments.

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/pradhanmausumi/zudio-franchise.git
cd zudio-franchise
```

2. **Install dependencies**
```bash
npm install
```

3. **Create `.env` file** in the root directory

> 🎯 **For Test Mode (Recommended for this project):**
```env
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Test Mode - ENABLED (No real payments)
TEST_MODE=true

# Redirect URLs (for test mode)
REDIRECT_URL=http://localhost:3000/payment-success
WEBHOOK_URL=http://localhost:3000/api/webhook

# Email Configuration (Optional - can be left empty)
# EMAIL_USER=your_email@gmail.com
# EMAIL_APP_PASSWORD=your_app_password

# Instamojo credentials NOT REQUIRED for test mode
# Leave these empty or commented out
# INSTAMOJO_API_KEY=
# INSTAMOJO_AUTH_TOKEN=
# INSTAMOJO_SALT=
```

> 🚀 **For Production Mode (If you want real payments):**
```env
# Server Configuration
PORT=3000
NODE_ENV=production
BASE_URL=https://your-domain.com

# Instamojo Configuration (Get from https://www.instamojo.com/)
INSTAMOJO_API_KEY=your_api_key_here
INSTAMOJO_AUTH_TOKEN=your_auth_token_here
INSTAMOJO_SALT=your_salt_here
INSTAMOJO_API_URL=https://api.instamojo.com/v2/

# Test Mode - DISABLED (Real payments)
TEST_MODE=false

# Redirect URLs
REDIRECT_URL=https://your-domain.com/payment-success
WEBHOOK_URL=https://your-domain.com/api/webhook

# Email Configuration (Recommended for production)
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_password
```

4. **Create `.gitignore` file**
```bash
# Environment variables
.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

## 🎯 Configuration

### 🧪 Test Mode (Default - Recommended for This Project)

**This is how the project is designed to work:**

✅ Set `TEST_MODE=true` in `.env` (or leave it default)
✅ No Instamojo credentials needed
✅ No real money transactions
✅ Built-in mock payment gateway
✅ Perfect for learning and demonstration

**What happens in Test Mode:**
1. User fills registration form
2. Clicks "Proceed to Payment"
3. Redirected to a **simulated payment page** (looks like Instamojo)
4. Can click "Simulate Successful Payment" or "Simulate Failed Payment"
5. Webhook is triggered automatically
6. Confirmation emails sent (if configured)
7. Payment status updated in system

**Benefits:**
- ✅ No payment gateway account needed
- ✅ No transaction fees
- ✅ Instant testing
- ✅ Safe for development
- ✅ Perfect for portfolio/demo projects

### 🚀 Production Mode (Optional - For Real Payments)

Only use this if you want to accept real payments:

1. **Sign up at [Instamojo](https://www.instamojo.com/)**
2. **Get credentials from Dashboard:**
   - API Key
   - Auth Token
   - Salt (for webhook verification)
3. **Update `.env`:**
   ```env
   TEST_MODE=false
   INSTAMOJO_API_KEY=your_actual_key
   INSTAMOJO_AUTH_TOKEN=your_actual_token
   INSTAMOJO_SALT=your_actual_salt
   ```
4. **Update URLs to your domain** (not localhost)

> ⚠️ **Note:** Production mode requires a live domain (not localhost) for webhooks to work properly.

### Email Setup (Gmail)

1. Enable 2-Step Verification in Gmail
2. Generate App Password:
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
3. Add to `.env`:
   ```env
   EMAIL_USER=your_email@gmail.com
   EMAIL_APP_PASSWORD=your_16_char_password
   ```

## 🏃 Running the Application

### Quick Start (Test Mode)

1. **Start the server**
```bash
npm start
```
or
```bash
node server.js
```

2. **Look for this in console:**
```
🚀 ZUDIO FRANCHISE SERVER - READY
📍 Server URL: http://localhost:3000
📄 HTML File: instamojo.html
💳 Payment Gateway: TEST MODE
📧 Email: Not configured
⚠️  TEST MODE ACTIVE - Mock payments enabled
```

3. **Access the application**
   - **Homepage:** `http://localhost:3000`
   - **Health Check:** `http://localhost:3000/health`
   - **Admin Payments:** `http://localhost:3000/api/admin/payments`
   - **Admin Enquiries:** `http://localhost:3000/api/admin/enquiries`

4. **Test the payment flow:**
   - Fill the registration form
   - Select a package (₹5,000 / ₹10,000 / ₹25,000)
   - Click "Proceed to Payment"
   - On test payment page, click "Simulate Successful Payment"
   - See success confirmation! ✅

> 💡 **Pro Tip:** Open browser DevTools (F12) → Console to see detailed logs of what's happening behind the scenes!

## 📡 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main landing page |
| GET | `/health` | Server health check |
| POST | `/api/create-payment` | Create payment request |
| POST | `/api/webhook` | Instamojo webhook |
| GET | `/payment-success` | Payment success page |
| POST | `/api/send-notification` | Send enquiry |
| GET | `/api/payment-status/:orderId` | Check payment status |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/payments` | List all payments |
| GET | `/api/admin/enquiries` | List all enquiries |

## 💳 Payment Flow (Test Mode)

### User Journey:

1. **Customer visits homepage** 
   - Sees Zudio franchise information
   - Fills quick registration form

2. **Selects package**
   - ₹5,000 - Basic Registration
   - ₹10,000 - Premium Registration  
   - ₹25,000 - Express Processing

3. **Clicks "Proceed to Payment"**
   - Modal opens with payment details
   - System creates mock payment request
   - Shows order ID and amount

4. **Redirected to Test Payment Page**
   - Simulated Instamojo-style interface
   - Shows payment amount and details
   - Two buttons available:
     - ✅ "Simulate Successful Payment"
     - ❌ "Simulate Failed Payment"

5. **Simulates payment**
   - Webhook automatically triggered
   - Payment status updated to "completed"
   - Redirects to success page

6. **Confirmation**
   - Success page with order details
   - Email sent (if configured)
   - Admin notified (if configured)

### Technical Flow:

```
User Form → Create Payment API → Mock Payment Link → 
Test Payment Page → Simulate Success → Webhook Call → 
Update Status → Success Page → Email Notifications
```

### Production Flow (if enabled):

```
User Form → Create Payment API → Real Instamojo Link → 
Instamojo Gateway → User Pays → Real Webhook → 
Update Status → Success Page → Email Notifications
```

## 📧 Email Notifications

### Customer Emails
- Payment link with order details
- Payment success confirmation
- Order tracking information

### Admin Emails
- New payment request alerts
- Payment completion notifications
- Customer enquiry notifications

## 🔒 Security Features

- MAC verification for webhooks
- Input validation and sanitization
- CORS configuration
- Secure payment gateway integration
- Environment variable protection

## 📂 Project Structure

```
zudio-franchise/
├── instamojo.html          # Frontend landing page
├── server.js               # Backend Express server
├── package.json            # Dependencies
├── .env                    # Environment variables (create this)
├── .gitignore             # Git ignore rules
└── README.md              # Documentation
```

## 🧪 Testing

### Test Payment Flow (Default Setup)

**Step-by-Step Testing:**

1. **Start the server**
   ```bash
   node server.js
   ```

2. **Open browser to** `http://localhost:3000`

3. **Fill the registration form:**
   - Name: Test User
   - Email: test@example.com
   - Phone: 9876543210
   - City: Mumbai
   - Package: ₹5,000 - Basic Registration

4. **Click "Proceed to Payment"**
   - Modal opens
   - System generates order ID
   - Creates mock payment link

5. **On test payment page:**
   - See simulated Instamojo interface
   - Amount displayed: ₹5,000
   - Order details shown
   - Click **"✓ Simulate Successful Payment"**

6. **Verify success:**
   - Redirected to success page
   - Check console logs for webhook call
   - Visit `http://localhost:3000/api/admin/payments` to see all payments

**Test Different Scenarios:**

✅ **Successful Payment:**
- Click "Simulate Successful Payment"
- Status → `completed`
- Email sent (if configured)

❌ **Failed Payment:**
- Click "Simulate Failed Payment"
- Returns to homepage
- Status → `pending`

🔍 **Check Payment Status:**
```bash
# Visit in browser:
http://localhost:3000/api/payment-status/ZUDIO_xxxxx
```

📊 **View All Payments:**
```bash
# Visit in browser:
http://localhost:3000/api/admin/payments
```

### Production Testing (Optional)

If you enable production mode:
1. Use Instamojo test credentials
2. Test with minimum amount (₹10)
3. Use test card numbers from Instamojo docs
4. Verify webhook responses
5. Check email deliveries

## 🐛 Troubleshooting

### Common Issues in Test Mode:

**1. Payment button does nothing**
```bash
# Solution: Check browser console for errors
# Make sure server is running on port 3000
# Verify the API endpoint in instamojo.html: http://localhost:3000
```

**2. "Cannot connect to server" error**
```bash
# Solution: Ensure server is running
node server.js

# Check if port 3000 is available
lsof -ti:3000 | xargs kill -9  # Kill any existing process
node server.js  # Restart
```

**3. Modal opens but no payment link**
```bash
# Check server console logs
# Should see: "⚠️ TEST MODE: Returning mock payment link"
# If not, verify TEST_MODE=true in .env
```

**4. Emails not sending**
```bash
# This is NORMAL in test mode without email configuration
# To enable emails:
# 1. Add EMAIL_USER and EMAIL_APP_PASSWORD to .env
# 2. Use Gmail App Password (not regular password)
# 3. Check spam folder
```

**5. Webhook not triggering**
```bash
# In test mode, webhook is triggered automatically
# Check server console for: "🔔 Webhook received from Instamojo"
# If missing, check test payment page JavaScript
```

### Server Issues:

**Port already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 node server.js
```

**Dependencies not installed:**
```bash
# Reinstall all packages
rm -rf node_modules package-lock.json
npm install
```

**Module not found errors:**
```bash
# Ensure all dependencies are in package.json
npm install express cors body-parser axios nodemailer dotenv
```

### Production Mode Issues:

**Payment not working in production:**
- ✅ Verify Instamojo credentials are correct
- ✅ Check `TEST_MODE=false` in .env
- ✅ Ensure webhook URL is publicly accessible (not localhost)
- ✅ Check Instamojo dashboard for API errors
- ✅ Review server console logs

**Webhook not received:**
- ✅ Webhook URL must be HTTPS in production
- ✅ URL must be publicly accessible
- ✅ Check Instamojo webhook logs
- ✅ Verify MAC signature if using salt

### Getting Help:

1. **Check server console** - Most errors are logged there
2. **Check browser console** - Frontend errors appear here
3. **Test API directly:**
   ```bash
   curl http://localhost:3000/health
   ```
4. **Enable detailed logging** - Look for emoji indicators in console:
   - ✅ = Success
   - ❌ = Error
   - ⚠️ = Warning
   - 🔔 = Webhook received
   - 📤 = API call made

## 🚀 Deployment

### Heroku
```bash
heroku create zudio-franchise
heroku config:set INSTAMOJO_API_KEY=your_key
heroku config:set INSTAMOJO_AUTH_TOKEN=your_token
git push heroku main
```

### Vercel/Netlify
- Deploy frontend (instamojo.html) separately
- Update API endpoints in HTML
- Configure environment variables

### VPS/Cloud
```bash
# Install dependencies
npm install --production

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name zudio-franchise

# Enable on startup
pm2 startup
pm2 save
```

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |
| `BASE_URL` | Yes | Your domain URL |
| `INSTAMOJO_API_KEY` | Production | Instamojo API key |
| `INSTAMOJO_AUTH_TOKEN` | Production | Instamojo auth token |
| `INSTAMOJO_SALT` | Optional | For MAC verification |
| `TEST_MODE` | No | Enable test payments (true/false) |
| `EMAIL_USER` | Optional | Gmail address |
| `EMAIL_APP_PASSWORD` | Optional | Gmail app password |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is for educational purposes. Zudio is a trademark of Trent Ltd. (Tata Group).

## 👨‍💻 Author

**Mausumi Pradhan**
- GitHub: [@pradhanmausumi](https://github.com/pradhanmausumi)

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Email: your_email@example.com

## 🙏 Acknowledgments

- Instamojo for payment gateway
- Express.js community
- Node.js team
- All contributors

---

**⚠️ Important Notes:**
- Never commit `.env` file to version control
- Always use HTTPS in production
- Test thoroughly before going live
- Keep dependencies updated
- Monitor payment webhooks regularly

**Made with ❤️ for Zudio Franchise Opportunities**
