const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./househunters.db');

db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    phone TEXT,
    location TEXT,
    role TEXT DEFAULT 'buyer'
)`);

app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`,
        [email, hashedPassword, name, role || 'buyer'],
        function(err) {
            if (err) return res.json({ success: false, message: 'Email exists' });
            res.json({ success: true, message: 'Registered!' });
        });
});

app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [identifier], async (err, user) => {
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong password' });
        
        res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
    });
});

app.get('/api/properties', (req, res) => {
    res.json({ success: true, properties: [] });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Server running'));
