const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS, images) from current directory
app.use(express.static('.'));

// Create uploads folder for property images
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
app.use('/uploads', express.static('uploads'));

// Database setup
const db = new sqlite3.Database('./househunters.db');

// Create all tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        phone TEXT,
        location TEXT,
        role TEXT DEFAULT 'buyer',
        is_verified INTEGER DEFAULT 0,
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

    console.log('✅ Database tables ready');
});

// Helper: generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== USER AUTH ====================

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, location, role } = req.body;
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (user) return res.json({ success: false, message: 'Email already registered' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        
        db.run(`INSERT INTO users (email, password, name, phone, location, role, verification_code) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, name, phone || '', location || '', role || 'buyer', otp],
            function(err) {
                if (err) return res.json({ success: false, message: 'Registration failed' });
                console.log(`📧 OTP for ${email}: ${otp}`);
                res.json({ success: true, message: `Registration successful! Use OTP: ${otp} to verify` });
            });
    });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid OTP' });
        db.run('UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?', [email], (err) => {
            if (err) return res.json({ success: false, message: 'Verification failed' });
            res.json({ 
                success: true, 
                message: 'Account verified successfully!',
                user: { name: user.name, email: user.email, role: user.role }
            });
        });
    });
});

// Resend OTP
app.post('/api/resend-otp', (req, res) => {
    const { email } = req.body;
    const newOtp = generateOTP();
    db.run('UPDATE users SET verification_code = ? WHERE email = ?', [newOtp, email], function(err) {
        if (err) return res.json({ success: false, message: 'Failed to resend code' });
        console.log(`📧 New OTP for ${email}: ${newOtp}`);
        res.json({ success: true, message: `New OTP sent: ${newOtp}` });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [identifier], async (err, user) => {
        if (!user) return res.json({ success: false, message: 'User not found' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong password' });
        if (!user.is_verified) {
            return res.json({ 
                success: false, 
                needsVerification: true, 
                email: user.email,
                message: 'Please verify your account first.'
            });
        }
        res.json({ success: true, user: { name: user.name, email: user.email, role: user.role, phone: user.phone, location: user.location } });
    });
});

// Check verification status
app.get('/api/check-verification/:email', (req, res) => {
    db.get('SELECT is_verified FROM users WHERE email = ?', [req.params.email], (err, user) => {
        if (!user) return res.json({ success: false, verified: false });
        res.json({ success: true, verified: user.is_verified === 1 });
    });
});

// Forgot Password - send OTP
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const otp = generateOTP();
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Email not found' });
        db.run('UPDATE users SET verification_code = ? WHERE email = ?', [otp, email], (err) => {
            if (err) return res.json({ success: false, message: 'Failed to send code' });
            console.log(`🔐 Password reset OTP for ${email}: ${otp}`);
            res.json({ success: true, message: `Reset code sent: ${otp}` });
        });
    });
});

// Verify reset OTP
app.post('/api/verify-reset-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid code' });
        res.json({ success: true, message: 'Code verified' });
    });
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], async (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid verification' });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ?, verification_code = NULL WHERE email = ?', [hashedPassword, email], (err) => {
            if (err) return res.json({ success: false, message: 'Failed to reset password' });
            res.json({ success: true, message: 'Password reset successful!' });
        });
    });
});

// ==================== PROFILE ====================

app.get('/api/profile/:email', (req, res) => {
    db.get('SELECT email, name, phone, location, role, created_at FROM users WHERE email = ?', [req.params.email], (err, user) => {
        if (!user) return res.json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    });
});

app.put('/api/profile/:email', (req, res) => {
    const { name, location, phone } = req.body;
    db.run('UPDATE users SET name = ?, location = ?, phone = ? WHERE email = ?', [name, location, phone, req.params.email], function(err) {
        if (err) return res.json({ success: false, message: 'Update failed' });
        res.json({ success: true, message: 'Profile updated' });
    });
});

// ==================== PROPERTIES ====================

// Get all properties (optionally filter by type)
app.get('/api/properties', (req, res) => {
    const { type } = req.query;
    let sql = 'SELECT * FROM properties ORDER BY created_at DESC';
    let params = [];
    if (type && type !== 'undefined' && type !== 'all') {
        sql = 'SELECT * FROM properties WHERE type = ? ORDER BY created_at DESC';
        params = [type];
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.json({ success: false, properties: [] });
        res.json({ success: true, properties: rows });
    });
});

// Get single property
app.get('/api/properties/:id', (req, res) => {
    db.get('SELECT * FROM properties WHERE id = ?', [req.params.id], (err, row) => {
        if (err || !row) return res.json({ success: false, message: 'Property not found' });
        res.json({ success: true, property: row });
    });
});

// Create property with image upload
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/properties', upload.array('images', 4), (req, res) => {
    const { title, description, price, location, type, bedrooms, bathrooms, area, postedBy, coordinates } = req.body;
    let imagePaths = req.files ? req.files.map(f => f.path).join(',') : '';
    let lat = null, lng = null;
    if (coordinates) {
        try { const coords = JSON.parse(coordinates); lat = coords.lat; lng = coords.lng; } catch(e) {}
    }
    db.run(`INSERT INTO properties (title, description, price, location, type, bedrooms, bathrooms, area, latitude, longitude, posted_by, images)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', price, location || '', type || 'apartments', bedrooms || 0, bathrooms || 0, area || 0, lat, lng, postedBy, imagePaths],
        function(err) {
            if (err) return res.json({ success: false, message: 'Failed to create listing: ' + err.message });
            res.json({ success: true, message: 'Listing created!', propertyId: this.lastID });
        });
});

// Delete property (only if user owns it)
app.delete('/api/properties/:id', (req, res) => {
    const { email } = req.body;
    db.get('SELECT posted_by FROM properties WHERE id = ?', [req.params.id], (err, property) => {
        if (!property) return res.json({ success: false, message: 'Property not found' });
        if (property.posted_by !== email) return res.json({ success: false, message: 'Unauthorized' });
        db.run('DELETE FROM properties WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.json({ success: false, message: 'Delete failed' });
            res.json({ success: true, message: 'Listing deleted' });
        });
    });
});

// Get user's own properties
app.get('/api/my-properties/:email', (req, res) => {
    db.all('SELECT * FROM properties WHERE posted_by = ? ORDER BY created_at DESC', [req.params.email], (err, rows) => {
        res.json({ success: true, properties: rows || [] });
    });
});

// ==================== MESSAGES (Chat) ====================

app.get('/api/messages/:user1/:user2', (req, res) => {
    const user1 = req.params.user1;
    const user2 = req.params.user2;
    db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY created_at ASC`,
        [user1, user2, user2, user1], (err, rows) => {
            res.json({ success: true, messages: rows || [] });
        });
});

app.post('/api/messages', (req, res) => {
    const { sender, receiver, message, propertyId } = req.body;
    db.run('INSERT INTO messages (sender, receiver, message, property_id) VALUES (?, ?, ?, ?)',
        [sender, receiver, message, propertyId || null], function(err) {
            if (err) return res.json({ success: false, message: 'Failed to send' });
            res.json({ success: true, message: 'Sent', id: this.lastID });
        });
});

// ==================== REQUESTS ====================

app.get('/api/requests', (req, res) => {
    db.all('SELECT * FROM requests ORDER BY created_at DESC', [], (err, rows) => {
        res.json({ success: true, requests: rows || [] });
    });
});

app.post('/api/requests', (req, res) => {
    const { title, description, type, budget, location, contactName, postedBy } = req.body;
    db.run(`INSERT INTO requests (title, description, type, budget, location, contact_name, posted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', type || 'general', budget || 0, location || '', contactName || '', postedBy],
        function(err) {
            if (err) return res.json({ success: false, message: 'Failed to post' });
            res.json({ success: true, message: 'Request posted!', requestId: this.lastID });
        });
});

// ==================== HEALTH & ROOT ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'HouseHunters API running' });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HouseHunters server running on port ${PORT}`);
    console.log(`📁 Static files being served from current directory`);
});
