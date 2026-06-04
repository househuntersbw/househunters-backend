// global.js - Shared functions for HouseHunters
const API_BASE = 'https://househunters-backend-1.onrender.com/api';

// Toggle modal visibility
function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
}

// Tab switching
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Load properties
async function loadProperties(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/properties${type ? '?type=' + type : ''}`);
        const data = await response.json();
        const properties = data.properties || [];
        if (properties.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No properties yet.</p></div>';
            return;
        }
        container.innerHTML = properties.map(prop => `
            <div class="listing-card">
                <h3>${escapeHtml(prop.title)}</h3>
                <p class="property-price">P${prop.price}</p>
                <p>📍 ${escapeHtml(prop.location)}</p>
                <small>${escapeHtml(prop.description?.substring(0, 100))}...</small>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>Error loading properties</p></div>';
    }
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Logout
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Check if user is logged in
function requireAuth() {
    if (!localStorage.getItem('userEmail')) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Get current user
function getCurrentUser() {
    return {
        email: localStorage.getItem('userEmail'),
        name: localStorage.getItem('userName'),
        role: localStorage.getItem('userRole')
    };
}
