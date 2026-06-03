const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve HTML files
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Database setup
const db = new sqlite3.Database('./househunters.db');

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        phone TEXT,
        location TEXT,
        role TEXT DEFAULT 'buyer',
        is_verified INTEGER DEFAULT 1,
        verification_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        price REAL,
        location TEXT,
        type TEXT,
        bedrooms INTEGER,
        bathrooms INTEGER,
        area REAL,
        latitude REAL,
        longitude REAL,
        posted_by TEXT,
        images TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        receiver TEXT,
        message TEXT,
        property_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        type TEXT,
        budget REAL,
        location TEXT,
        contact_name TEXT,
        posted_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    console.log('✅ Database ready');
});

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============ API ENDPOINTS ============

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, location, role } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (user) {
            return res.json({ success: false, message: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        
        db.run(`INSERT INTO users (email, password, name, phone, location, role, verification_code, is_verified) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [email, hashedPassword, name, phone || '', location || '', role || 'buyer', otp],
            function(err) {
                if (err) {
                    return res.json({ success: false, message: 'Registration failed' });
                }
                res.json({ 
                    success: true, 
                    message: 'Registration successful! You can now login.',
                    user: { name, email, role }
                });
            });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [identifier], async (err, user) => {
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, message: 'Invalid password' });
        }
        
        res.json({
            success: true,
            message: 'Login successful',
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                phone: user.phone,
                location: user.location
            }
        });
    });
});

// Get all properties
app.get('/api/properties', (req, res) => {
    const { type } = req.query;
    let query = 'SELECT * FROM properties ORDER BY created_at DESC';
    let params = [];
    
    if (type && type !== 'undefined' && type !== 'all') {
        query = 'SELECT * FROM properties WHERE type = ? ORDER BY created_at DESC';
        params = [type];
    }
    
    db.all(query, params, (err, properties) => {
        res.json({ success: true, properties: properties || [] });
    });
});

// Create property listing with image upload
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.post('/api/properties', upload.array('images', 4), (req, res) => {
    const { title, description, price, location, type, bedrooms, bathrooms, area, postedBy, coordinates } = req.body;
    
    let imagePaths = [];
    if (req.files) {
        imagePaths = req.files.map(f => f.path);
    }
    
    db.run(`INSERT INTO properties (title, description, price, location, type, bedrooms, bathrooms, area, posted_by, images)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', price, location || '', type || 'apartments', 
         bedrooms || 0, bathrooms || 0, area || 0, postedBy, imagePaths.join(',')],
        function(err) {
            if (err) {
                return res.json({ success: false, message: 'Failed to create listing' });
            }
            res.json({ success: true, message: 'Listing created!', propertyId: this.lastID });
        });
});

// Get user profile
app.get('/api/profile/:email', (req, res) => {
    db.get('SELECT email, name, phone, location, role, created_at FROM users WHERE email = ?', 
        [decodeURIComponent(req.params.email)], (err, user) => {
            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }
            res.json({ success: true, user });
        });
});

// Update user profile
app.put('/api/profile/:email', (req, res) => {
    const { name, location, phone } = req.body;
    const email = decodeURIComponent(req.params.email);
    
    db.run('UPDATE users SET name = ?, location = ?, phone = ? WHERE email = ?',
        [name, location, phone, email], function(err) {
            if (err) {
                return res.json({ success: false, message: 'Update failed' });
            }
            res.json({ success: true, message: 'Profile updated' });
        });
});

// Get messages
app.get('/api/messages/:user1/:user2', (req, res) => {
    const user1 = decodeURIComponent(req.params.user1);
    const user2 = decodeURIComponent(req.params.user2);
    
    db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) 
            ORDER BY created_at ASC`, 
        [user1, user2, user2, user1], 
        (err, messages) => {
            res.json({ success: true, messages: messages || [] });
        });
});

// Send message
app.post('/api/messages', (req, res) => {
    const { sender, receiver, message, propertyId } = req.body;
    
    db.run('INSERT INTO messages (sender, receiver, message, property_id) VALUES (?, ?, ?, ?)',
        [sender, receiver, message, propertyId || null], function(err) {
            if (err) {
                return res.json({ success: false, message: 'Failed to send message' });
            }
            res.json({ success: true, message: 'Message sent' });
        });
});

// Post a request (buyer/seller/agent)
app.post('/api/requests', (req, res) => {
    const { title, description, type, budget, location, contactName, postedBy } = req.body;
    
    db.run(`INSERT INTO requests (title, description, type, budget, location, contact_name, posted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', type || 'general', budget || 0, location || '', contactName || '', postedBy],
        function(err) {
            if (err) {
                return res.json({ success: false, message: 'Failed to post request' });
            }
            res.json({ success: true, message: 'Request posted!' });
        });
});

// Get all requests
app.get('/api/requests', (req, res) => {
    db.all('SELECT * FROM requests ORDER BY created_at DESC', [], (err, requests) => {
        res.json({ success: true, requests: requests || [] });
    });
});

// Forgot password - send OTP (simplified)
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const otp = generateOTP();
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) {
            return res.json({ success: false, message: 'Email not found' });
        }
        db.run('UPDATE users SET verification_code = ? WHERE email = ?', [otp, email]);
        res.json({ success: true, message: 'Reset code sent (demo: ' + otp + ')' });
    });
});

// Verify reset OTP
app.post('/api/verify-reset-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], (err, user) => {
        if (!user) {
            return res.json({ success: false, message: 'Invalid code' });
        }
        res.json({ success: true, message: 'Code verified' });
    });
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], async (err, user) => {
        if (!user) {
            return res.json({ success: false, message: 'Invalid verification' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ?, verification_code = NULL WHERE email = ?', [hashedPassword, email]);
        res.json({ success: true, message: 'Password reset successful!' });
    });
});

// Check verification status (simplified)
app.get('/api/check-verification/:email', (req, res) => {
    res.json({ success: true, verified: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'HouseHunters API is live!' });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HouseHunters API running on port ${PORT}`);
});
