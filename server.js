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
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Create directories
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('uploads/profiles')) fs.mkdirSync('uploads/profiles', { recursive: true });

// Database - Use /tmp on Render for writable storage
const dbPath = process.env.RENDER ? '/tmp/househunters.db' : './househunters.db';
const db = new sqlite3.Database(dbPath);

// Create ALL tables
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
        profile_picture TEXT,
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
        is_read INTEGER DEFAULT 0,
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

    db.run(`CREATE TABLE IF NOT EXISTS saved_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_email TEXT,
        property_id INTEGER,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(buyer_email, property_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_email TEXT,
        user2_email TEXT,
        connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_email, user2_email)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_email TEXT,
        seller_email TEXT,
        property_id INTEGER,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('✅ Database tables ready at', dbPath);
});

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// ============ AUTH ENDPOINTS ============

app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, location, role } = req.body;
    if (!name || !email || !password) return res.json({ success: false, message: 'Missing fields' });
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (user) return res.json({ success: false, message: 'Email exists' });
        const hashed = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        db.run(`INSERT INTO users (email, password, name, phone, location, role, verification_code) VALUES (?,?,?,?,?,?,?)`,
            [email, hashed, name, phone || '', location || '', role || 'buyer', otp], function(err) {
                if (err) return res.json({ success: false, message: 'Registration failed' });
                console.log(`OTP for ${email}: ${otp}`);
                res.json({ success: true, message: `Registered! Use OTP: ${otp}` });
            });
    });
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid OTP' });
        db.run('UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?', [email]);
        res.json({ success: true, message: 'Verified!', user: { name: user.name, email: user.email, role: user.role } });
    });
});

app.post('/api/resend-otp', (req, res) => {
    const { email } = req.body;
    const newOtp = generateOTP();
    db.run('UPDATE users SET verification_code = ? WHERE email = ?', [newOtp, email]);
    res.json({ success: true, message: `New OTP: ${newOtp}` });
});

app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [identifier], async (err, user) => {
        if (!user) return res.json({ success: false, message: 'User not found' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong password' });
        if (!user.is_verified) return res.json({ success: false, needsVerification: true, email: user.email, message: 'Please verify' });
        res.json({ success: true, user: { name: user.name, email: user.email, role: user.role, phone: user.phone, location: user.location } });
    });
});

app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const otp = generateOTP();
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Email not found' });
        db.run('UPDATE users SET verification_code = ? WHERE email = ?', [otp, email]);
        res.json({ success: true, message: `Reset code: ${otp}` });
    });
});

app.post('/api/verify-reset-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid code' });
        res.json({ success: true, message: 'Code verified' });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND verification_code = ?', [email, otp], async (err, user) => {
        if (!user) return res.json({ success: false, message: 'Invalid' });
        const hashed = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ?, verification_code = NULL WHERE email = ?', [hashed, email]);
        res.json({ success: true, message: 'Password reset!' });
    });
});

// ============ USER LIST ENDPOINTS ============

app.get('/api/users/agents', (req, res) => {
    db.all('SELECT email, name, phone, location, profile_picture FROM users WHERE role = ? AND is_verified = 1', ['agent'], (err, agents) => {
        res.json({ success: true, agents: agents || [] });
    });
});

app.get('/api/users/sellers', (req, res) => {
    db.all('SELECT email, name, phone, location, profile_picture FROM users WHERE role = ? AND is_verified = 1', ['seller'], (err, sellers) => {
        res.json({ success: true, sellers: sellers || [] });
    });
});

// ============ PROFILE ENDPOINTS ============

app.get('/api/profile/:email', (req, res) => {
    db.get('SELECT email, name, phone, location, role, profile_picture, created_at FROM users WHERE email = ?', [req.params.email], (err, user) => {
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

const profileStorage = multer.diskStorage({
    destination: 'uploads/profiles/',
    filename: (req, file, cb) => {
        cb(null, req.params.email.replace(/[^a-zA-Z0-9]/g, '_') + path.extname(file.originalname));
    }
});
const profileUpload = multer({ storage: profileStorage, limits: { fileSize: 2 * 1024 * 1024 } });

app.post('/api/profile/:email/picture', profileUpload.single('profilePic'), (req, res) => {
    if (!req.file) return res.json({ success: false, message: 'No file' });
    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    db.run('UPDATE users SET profile_picture = ? WHERE email = ?', [imageUrl, req.params.email]);
    res.json({ success: true, imageUrl: imageUrl });
});

app.delete('/api/profile/:email', (req, res) => {
    const email = req.params.email;
    db.run('DELETE FROM messages WHERE sender = ? OR receiver = ?', [email, email]);
    db.run('DELETE FROM properties WHERE posted_by = ?', [email]);
    db.run('DELETE FROM requests WHERE posted_by = ?', [email]);
    db.run('DELETE FROM saved_listings WHERE buyer_email = ?', [email]);
    db.run('DELETE FROM users WHERE email = ?', [email], () => {
        res.json({ success: true, message: 'Account deleted' });
    });
});

// ============ PROPERTIES ENDPOINTS ============

app.get('/api/properties', (req, res) => {
    const { type } = req.query;
    let sql = 'SELECT * FROM properties ORDER BY created_at DESC';
    let params = [];
    if (type && type !== 'undefined' && type !== 'all') {
        sql = 'SELECT * FROM properties WHERE type = ? ORDER BY created_at DESC';
        params = [type];
    }
    db.all(sql, params, (err, rows) => {
        res.json({ success: true, properties: rows || [] });
    });
});

app.get('/api/my-properties/:email', (req, res) => {
    db.all('SELECT * FROM properties WHERE posted_by = ? ORDER BY created_at DESC', [req.params.email], (err, rows) => {
        res.json({ success: true, properties: rows || [] });
    });
});

const propertyStorage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const propertyUpload = multer({ storage: propertyStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/properties', propertyUpload.array('images', 4), (req, res) => {
    const { title, description, price, location, type, bedrooms, bathrooms, area, postedBy } = req.body;
    const images = req.files ? req.files.map(f => f.path).join(',') : '';
    db.run(`INSERT INTO properties (title, description, price, location, type, bedrooms, bathrooms, area, posted_by, images)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [title, description || '', price, location || '', type || 'apartments', bedrooms || 0, bathrooms || 0, area || 0, postedBy, images],
        function(err) {
            if (err) return res.json({ success: false, message: 'Failed' });
            res.json({ success: true, message: 'Listing created!', propertyId: this.lastID });
        });
});

app.delete('/api/properties/:id', (req, res) => {
    const { email } = req.body;
    db.get('SELECT posted_by FROM properties WHERE id = ?', [req.params.id], (err, prop) => {
        if (!prop) return res.json({ success: false, message: 'Not found' });
        if (prop.posted_by !== email) return res.json({ success: false, message: 'Unauthorized' });
        db.run('DELETE FROM properties WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Deleted' });
    });
});

// ============ SAVED LISTINGS ============

app.get('/api/saved-listings/:email', (req, res) => {
    db.all(`
        SELECT p.* FROM saved_listings s 
        JOIN properties p ON s.property_id = p.id 
        WHERE s.buyer_email = ? 
        ORDER BY s.saved_at DESC
    `, [req.params.email], (err, listings) => {
        res.json({ success: true, listings: listings || [] });
    });
});

app.post('/api/saved-listings', (req, res) => {
    const { buyer_email, property_id } = req.body;
    db.run(`INSERT OR IGNORE INTO saved_listings (buyer_email, property_id) VALUES (?, ?)`, 
        [buyer_email, property_id], function(err) {
            res.json({ success: true, message: 'Listing saved!' });
        });
});

app.delete('/api/saved-listings/:email/:propertyId', (req, res) => {
    db.run('DELETE FROM saved_listings WHERE buyer_email = ? AND property_id = ?', [req.params.email, req.params.propertyId], () => {
        res.json({ success: true, message: 'Removed' });
    });
});

// ============ CHAT ============

app.get('/api/conversations/:email', (req, res) => {
    const email = req.params.email;
    db.all(`
        SELECT DISTINCT 
            CASE WHEN sender = ? THEN receiver ELSE sender END as other_user,
            (SELECT message FROM messages m2 WHERE (m2.sender = ? AND m2.receiver = other_user) OR (m2.sender = other_user AND m2.receiver = ?) ORDER BY created_at DESC LIMIT 1) as last_message
        FROM messages WHERE sender = ? OR receiver = ?
        GROUP BY other_user ORDER BY last_message DESC
    `, [email, email, email, email, email], (err, conversations) => {
        res.json({ success: true, conversations: conversations || [] });
    });
});

app.get('/api/messages/:user1/:user2', (req, res) => {
    db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY created_at ASC`,
        [req.params.user1, req.params.user2, req.params.user2, req.params.user1], (err, messages) => {
            res.json({ success: true, messages: messages || [] });
        });
});

app.post('/api/messages', (req, res) => {
    const { sender, receiver, message } = req.body;
    if (!sender || !receiver || !message) return res.json({ success: false, message: 'Missing fields' });
    
    db.run(`INSERT OR IGNORE INTO connections (user1_email, user2_email) VALUES (?, ?)`, [sender, receiver]);
    db.run(`INSERT INTO messages (sender, receiver, message) VALUES (?,?,?)`, [sender, receiver, message], function(err) {
        if (err) return res.json({ success: false, message: 'Failed' });
        res.json({ success: true, message: 'Sent' });
    });
});

// ============ REQUESTS ============

app.get('/api/requests', (req, res) => {
    db.all('SELECT * FROM requests ORDER BY created_at DESC', [], (err, rows) => {
        res.json({ success: true, requests: rows || [] });
    });
});

app.post('/api/requests', (req, res) => {
    const { title, description, type, budget, location, contactName, postedBy } = req.body;
    db.run(`INSERT INTO requests (title, description, type, budget, location, contact_name, posted_by)
            VALUES (?,?,?,?,?,?,?)`,
        [title, description || '', type || 'general', budget || 0, location || '', contactName || '', postedBy],
        function(err) {
            res.json({ success: true, message: 'Request posted!' });
        });
});

// ============ HEALTH ============

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
