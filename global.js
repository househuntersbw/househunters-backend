// global.js - HouseHunters
const API_BASE = 'https://househunters-backend-1.onrender.com/api';

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
}

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.style.display = 'block';
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') === `openTab('${tabName}')`) {
            btn.classList.add('active');
        }
    });
}

async function loadProperties(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="listing-card">Loading...</div>';
    try {
        const url = type && type !== 'all' ? `${API_BASE}/properties?type=${type}` : `${API_BASE}/properties`;
        const response = await fetch(url);
        const data = await response.json();
        const properties = data.properties || [];
        if (properties.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No properties yet.</p></div>';
            return;
        }
        container.innerHTML = properties.map(prop => `
            <div class="listing-card">
                <h3>${escapeHtml(prop.title)}</h3>
                <p class="property-price">P${prop.price?.toLocaleString() || 0}</p>
                <p>📍 ${escapeHtml(prop.location) || 'Botswana'}</p>
                <small>${escapeHtml(prop.description?.substring(0, 100))}...</small>
                ${prop.images ? '<small>📸 Has images</small>' : ''}
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading properties</p></div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function requireAuth() {
    if (!localStorage.getItem('userEmail')) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function getCurrentUser() {
    return {
        email: localStorage.getItem('userEmail'),
        name: localStorage.getItem('userName'),
        role: localStorage.getItem('userRole')
    };
}

// Smart navigation - call this on every page
function setupSmartNav() {
    const role = localStorage.getItem('userRole') || 'buyer';
    const roleMap = { buyer: 'buyer.html', seller: 'seller.html', agent: 'agent.html' };
    const homeLink = roleMap[role];
    
    const navItems = document.querySelectorAll('.nav-item');
    const currentPage = window.location.pathname.split('/').pop();
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        }
        if (item.querySelector('i.fa-home') && homeLink) {
            item.setAttribute('href', homeLink);
        }
    });
}

// Load managed listings for agent
async function loadManagedListings() {
    const email = localStorage.getItem('userEmail');
    const container = document.getElementById('managedListingsContainer');
    if (!container) return;
    container.innerHTML = '<div class="listing-card">Loading your listings...</div>';
    try {
        const response = await fetch(`${API_BASE}/my-properties/${encodeURIComponent(email)}`);
        const data = await response.json();
        const listings = data.properties || [];
        if (listings.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>You have no listings yet. Click Create to add one.</p></div>';
            return;
        }
        container.innerHTML = listings.map(prop => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(prop.title)}</h4>
                <p class="property-price">P${prop.price?.toLocaleString() || 0}</p>
                <p>📍 ${escapeHtml(prop.location) || 'Botswana'}</p>
                <button class="btn small danger" onclick="deleteListingFromModal(${prop.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading listings</p></div>';
    }
}

async function deleteListingFromModal(id) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/properties/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        alert('✅ Listing deleted');
        loadManagedListings();
        const featuredContainer = document.getElementById('featuredListings');
        if (featuredContainer) loadProperties('all', 'featuredListings');
    } catch (error) {
        alert('❌ Error deleting');
    }
}

// Load connected clients for agent
async function loadConnectedClients() {
    const container = document.getElementById('connectedClientsList');
    if (!container) return;
    container.innerHTML = '<div class="listing-card">Loading clients...</div>';
    try {
        const response = await fetch(`${API_BASE}/connections/${encodeURIComponent(localStorage.getItem('userEmail'))}`);
        const data = await response.json();
        const clients = data.connections || [];
        if (clients.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No connected clients yet. When buyers message you, they appear here.</p></div>';
            return;
        }
        container.innerHTML = clients.map(c => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(c.name || c.email.split('@')[0])}</h4>
                <p>📧 ${escapeHtml(c.email)}</p>
                <button class="btn small" onclick="window.location.href='chat.html'">Message</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ No clients yet</p></div>';
    }
}

// Load agents for buyer
async function loadAgentsList() {
    const container = document.getElementById('agentsList');
    if (!container) return;
    container.innerHTML = '<div class="listing-card">Loading agents...</div>';
    try {
        const response = await fetch(`${API_BASE}/users/agents`);
        const data = await response.json();
        const agents = data.agents || [];
        if (agents.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No agents available yet.</p></div>';
            return;
        }
        container.innerHTML = agents.map(a => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(a.name || a.email.split('@')[0])}</h4>
                <p>📧 ${escapeHtml(a.email)}</p>
                <button class="btn small" onclick="window.location.href='chat.html'">Contact</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading agents</p></div>';
    }
}

// Load saved listings for buyer
async function loadSavedListings() {
    const container = document.getElementById('managedListingsContainer');
    if (!container) return;
    const email = localStorage.getItem('userEmail');
    container.innerHTML = '<div class="listing-card">Loading saved listings...</div>';
    try {
        const response = await fetch(`${API_BASE}/saved-listings/${encodeURIComponent(email)}`);
        const data = await response.json();
        const listings = data.listings || [];
        if (listings.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No saved listings yet. Browse properties and click Save.</p></div>';
            return;
        }
        container.innerHTML = listings.map(prop => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(prop.title)}</h4>
                <p class="property-price">P${prop.price?.toLocaleString() || 0}</p>
                <button class="btn small danger" onclick="unsaveListing(${prop.id})">Remove</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading saved listings</p></div>';
    }
}

async function unsaveListing(propertyId) {
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/saved-listings/${email}/${propertyId}`, { method: 'DELETE' });
        alert('✅ Removed from saved');
        loadSavedListings();
    } catch (error) {
        alert('❌ Error removing');
    }
}

// Load sellers for buyer
async function loadSellersList() {
    const container = document.getElementById('sellersList');
    if (!container) return;
    container.innerHTML = '<div class="listing-card">Loading sellers...</div>';
    try {
        const response = await fetch(`${API_BASE}/users/sellers`);
        const data = await response.json();
        const sellers = data.sellers || [];
        if (sellers.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No sellers available yet.</p></div>';
            return;
        }
        container.innerHTML = sellers.map(s => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(s.name || s.email.split('@')[0])}</h4>
                <p>📧 ${escapeHtml(s.email)}</p>
                <button class="btn small" onclick="window.location.href='chat.html'">Contact</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading sellers</p></div>';
    }
}

// Load inquiries for seller
async function loadInquiries() {
    const container = document.getElementById('inquiriesList');
    if (!container) return;
    const email = localStorage.getItem('userEmail');
    container.innerHTML = '<div class="listing-card">Loading inquiries...</div>';
    try {
        const response = await fetch(`${API_BASE}/inquiries/${encodeURIComponent(email)}`);
        const data = await response.json();
        const inquiries = data.inquiries || [];
        if (inquiries.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No inquiries yet. When buyers message about your listings, they appear here.</p></div>';
            return;
        }
        container.innerHTML = inquiries.map(i => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>${escapeHtml(i.buyer_name || i.buyer_email.split('@')[0])}</h4>
                <p>📧 ${escapeHtml(i.buyer_email)}</p>
                <p>📝 "${escapeHtml(i.message)}"</p>
                <p><small>Property: ${escapeHtml(i.property_title)}</small></p>
                <button class="btn small" onclick="window.location.href='chat.html'">Reply</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ No inquiries yet</p></div>';
    }
}

// Call this on page load for relevant pages
document.addEventListener('DOMContentLoaded', () => {
    setupSmartNav();
});