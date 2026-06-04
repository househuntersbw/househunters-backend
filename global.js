// global.js - Shared functions for HouseHunters
const API_BASE = 'https://househunters-backend-1.onrender.com';

// Toggle modal visibility
function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
}

// Tab switching (for dashboard pages)
function openTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    // Show selected tab
    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.style.display = 'block';
    // Update active button style
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Load properties into a container (used on apartments, standalone, etc.)
async function loadProperties(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/api/properties${type ? '?type=' + type : ''}`);
        const data = await response.json();
        const properties = data.properties || [];
        if (properties.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No properties found. Be the first to create a listing!</p></div>';
            return;
        }
        container.innerHTML = properties.map(prop => `
            <div class="listing-card">
                <h3 class="property-title">${escapeHtml(prop.title)}</h3>
                <p class="property-price">P${prop.price}</p>
                <p class="property-location">📍 ${escapeHtml(prop.location)}</p>
                <p>${escapeHtml(prop.description?.substring(0, 100))}...</p>
                <button class="btn small" onclick="viewProperty(${prop.id})">View Details</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading properties:', error);
        container.innerHTML = '<div class="listing-card"><p>Error loading properties. Please try again.</p></div>';
    }
}

// View property details (you can expand this)
function viewProperty(id) {
    alert(`Property details for ID ${id} - Coming soon`);
}

// Post a request from agent dashboard
async function postAgentRequest() {
    const title = document.getElementById('requestTitle')?.value;
    const description = document.getElementById('requestDesc')?.value;
    const type = document.getElementById('requestType')?.value;
    const budget = document.getElementById('requestBudget')?.value;
    const location = document.getElementById('requestLocation')?.value;
    const postedBy = localStorage.getItem('userEmail');
    const contactName = localStorage.getItem('userName') || 'Agent';

    if (!title || !description) {
        alert('Please fill in title and description');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName, postedBy })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Request posted successfully!');
            toggleModal('newRequest', false);
            document.getElementById('requestTitle').value = '';
            document.getElementById('requestDesc').value = '';
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Network error: ' + error.message);
    }
}

// Post a request from seller dashboard
async function postSellerRequest() {
    const title = document.getElementById('sellerRequestTitle')?.value;
    const description = document.getElementById('sellerRequestDesc')?.value;
    const type = document.getElementById('sellerRequestType')?.value;
    const budget = document.getElementById('sellerRequestBudget')?.value;
    const location = document.getElementById('sellerRequestLocation')?.value;
    const postedBy = localStorage.getItem('userEmail');
    const contactName = localStorage.getItem('userName') || 'Seller';

    if (!title || !description) {
        alert('Please fill in title and description');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName, postedBy })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Request posted successfully!');
            toggleModal('sellerRequest', false);
            document.getElementById('sellerRequestTitle').value = '';
            document.getElementById('sellerRequestDesc').value = '';
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Network error: ' + error.message);
    }
}

// Helper to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Load user's own listings (for seller dashboard)
async function loadMyListings() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    const container = document.getElementById('allListings');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/api/my-properties/${encodeURIComponent(email)}`);
        const data = await response.json();
        const listings = data.properties || [];
        if (listings.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>You have no listings yet. Click "Create Listing" to add one.</p></div>';
            return;
        }
        container.innerHTML = listings.map(prop => `
            <div class="listing-card">
                <h3>${escapeHtml(prop.title)}</h3>
                <p>Price: P${prop.price}</p>
                <p>Location: ${escapeHtml(prop.location)}</p>
                <button class="btn small danger" onclick="deleteListing(${prop.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>Error loading your listings.</p></div>';
    }
}

// Delete a listing
async function deleteListing(id) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const email = localStorage.getItem('userEmail');
    try {
        const response = await fetch(`${API_BASE}/api/properties/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Listing deleted');
            loadMyListings();
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Network error');
    }
}

// Initialize page-specific features
document.addEventListener('DOMContentLoaded', function() {
    // Load properties on property listing pages (apartments, standalone, etc.)
    const type = document.body.getAttribute('data-property-type');
    if (type && document.getElementById('allListings')) {
        loadProperties(type, 'allListings');
    }
    // Load featured properties if container exists
    if (document.getElementById('featuredListings')) {
        loadProperties('all', 'featuredListings');
    }
    // Load seller's own listings on seller dashboard
    if (document.getElementById('allListings') && window.location.pathname.includes('seller.html')) {
        loadMyListings();
    }
});
