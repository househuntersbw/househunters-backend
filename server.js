const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from current directory
app.use(express.static('.'));

// Create uploads directories
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('uploads/profiles')) fs.mkdirSync('uploads/profiles', { recursive: true });

app.use('/uploads', express.static('uploads'));

// ============ DATABASE SETUP ============
const db = new sqlite3.Database('./househunters.db');

// Create all tables
db.serialize(() => {
    // Users table with profile picture
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
        profile_picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Properties table
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

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        receiver TEXT,
        message TEXT,
        property_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Requests table
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

// Helper: Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Get user by email
function getUserByEmail(email, callback) {
    db.get('SELECT * FROM users WHERE email = ?', [email], callback);
}

// ============ AUTHENTICATION ENDPOINTS ============

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, location, role } = req.body;
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    getUserByEmail(email, async (err, user) => {
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
                message: 'Please verify your account first. Check your email for OTP.'
            });
        }
        res.json({ 
            success: true, 
            user: { name: user.name, email: user.email, role: user.role, phone: user.phone, location: user.location } 
        });
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
    getUserByEmail(email, (err, user) => {
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

// ============ PROFILE ENDPOINTS ============

// Get profile
app.get('/api/profile/:email', (req, res) => {
    db.get('SELECT email, name, phone, location, role, profile_picture, created_at FROM users WHERE email = ?', 
        [req.params.email], (err, user) => {
            if (!user) return res.json({ success: false, message: 'User not found' });
            res.json({ success: true, user });
        });
});

// Update profile
app.put('/api/profile/:email', (req, res) => {
    const { name, location, phone } = req.body;
    db.run('UPDATE users SET name = ?, location = ?, phone = ? WHERE email = ?', 
        [name, location, phone, req.params.email], function(err) {
            if (err) return res.json({ success: false, message: 'Update failed' });
            res.json({ success: true, message: 'Profile updated' });
        });
});

// Upload profile picture
const profileStorage = multer.diskStorage({
    destination: 'uploads/profiles/',
    filename: (req, file, cb) => {
        const email = req.params.email;
        const ext = path.extname(file.originalname);
        cb(null, email.replace(/[^a-zA-Z0-9]/g, '_') + ext);
    }
});
const profileUpload = multer({ storage: profileStorage, limits: { fileSize: 2 * 1024 * 1024 } });

app.post('/api/profile/:email/picture', profileUpload.single('profilePic'), (req, res) => {
    const email = req.params.email;
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });
    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    db.run('UPDATE users SET profile_picture = ? WHERE email = ?', [imageUrl, email], (err) => {
        if (err) return res.json({ success: false, message: 'Database error' });
        res.json({ success: true, imageUrl: imageUrl });
    });
});

// Get profile picture
app.get('/api/profile/:email/picture', (req, res) => {
    db.get('SELECT profile_picture FROM users WHERE email = ?', [req.params.email], (err, user) => {
        if (err || !user || !user.profile_picture) {
            return res.json({ success: false, imageUrl: null });
        }
        res.json({ success: true, imageUrl: user.profile_picture });
    });
});

// Delete account
app.delete('/api/profile/:email', (req, res) => {
    const email = req.params.email;
    db.run('DELETE FROM messages WHERE sender = ? OR receiver = ?', [email, email]);
    db.run('DELETE FROM properties WHERE posted_by = ?', [email]);
    db.run('DELETE FROM requests WHERE posted_by = ?', [email]);
    db.run('DELETE FROM users WHERE email = ?', [email], function(err) {
        if (err) return res.json({ success: false, message: 'Delete failed' });
        res.json({ success: true, message: 'Account deleted' });
    });
});

// ============ PROPERTIES ENDPOINTS ============

// Get all properties
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
        res.json({ success: true, properties: rows || [] });
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
const propertyStorage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const propertyUpload = multer({ storage: propertyStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/properties', propertyUpload.array('images', 4), (req, res) => {
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

// Delete property
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

// ============ CHAT ENDPOINTS ============

// Get all conversations for a user
app.get('/api/conversations/:email', (req, res) => {
    const email = req.params.email;
    db.all(`
        SELECT DISTINCT 
            CASE 
                WHEN sender = ? THEN receiver 
                ELSE sender 
            END as other_user,
            MAX(created_at) as last_message_time,
            (SELECT message FROM messages m2 WHERE (m2.sender = ? AND m2.receiver = other_user) OR (m2.sender = other_user AND m2.receiver = ?) ORDER BY created_at DESC LIMIT 1) as last_message
        FROM messages 
        WHERE sender = ? OR receiver = ?
        GROUP BY other_user
        ORDER BY last_message_time DESC
    `, [email, email, email, email, email], (err, conversations) => {
        if (err) return res.json({ success: false, conversations: [] });
        res.json({ success: true, conversations: conversations || [] });
    });
});

// Get messages between two users
app.get('/api/messages/:user1/:user2', (req, res) => {
    const user1 = req.params.user1;
    const user2 = req.params.user2;
    db.all(`
        SELECT * FROM messages 
        WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
        ORDER BY created_at ASC
    `, [user1, user2, user2, user1], (err, messages) => {
        if (err) return res.json({ success: false, messages: [] });
        res.json({ success: true, messages: messages || [] });
    });
});

// Send a message
app.post('/api/messages', (req, res) => {
    const { sender, receiver, message, propertyId } = req.body;
    if (!sender || !receiver || !message) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    db.run(`
        INSERT INTO messages (sender, receiver, message, property_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
    `, [sender, receiver, message, propertyId || null], function(err) {
        if (err) return res.json({ success: false, message: 'Failed to send message' });
        res.json({ success: true, message: 'Message sent', messageId: this.lastID });
    });
});

// Mark messages as read
app.post('/api/messages/read', (req, res) => {
    const { currentUser, otherUser } = req.body;
    db.run(`
        UPDATE messages SET is_read = 1 
        WHERE sender = ? AND receiver = ? AND is_read = 0
    `, [otherUser, currentUser], function(err) {
        res.json({ success: true });
    });
});

// ============ REQUESTS ENDPOINTS ============

// Get all requests
app.get('/api/requests', (req, res) => {
    db.all('SELECT * FROM requests ORDER BY created_at DESC', [], (err, rows) => {
        res.json({ success: true, requests: rows || [] });
    });
});

// Post a request
app.post('/api/requests', (req, res) => {
    const { title, description, type, budget, location, contactName, postedBy } = req.body;
    db.run(`INSERT INTO requests (title, description, type, budget, location, contact_name, posted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', type || 'general', budget || 0, location || '', contactName || '', postedBy],
        function(err) {
            if (err) return res.json({ success: false, message: 'Failed to post request' });
            res.json({ success: true, message: 'Request posted!', requestId: this.lastID });
        });
});

// ============ HEALTH CHECK & ROOT ============

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'HouseHunters API is live!' });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║   🏠 HouseHunters Botswana Backend     ║
    ║                                        ║
    ║   Server running on port: ${PORT}        ║
    ║   API: http://localhost:${PORT}/api     ║
    ║                                        ║
    ║   ✅ Database connected                ║
    ║   ✅ Auth endpoints ready              ║
    ║   ✅ Chat endpoints ready              ║
    ║   ✅ Properties endpoints ready        ║
    ║   ✅ Profile with pictures ready       ║
    ╚════════════════════════════════════════╝
    `);
});
