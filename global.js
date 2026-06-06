// global.js - HouseHunters COMPLETE
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

// Load properties with images, save button, inquiry button
async function loadProperties(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const currentUser = getCurrentUser();
    const userRole = currentUser.role;
    const userEmail = currentUser.email;
    
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
        
        // Check which properties are saved by this buyer
        let savedIds = [];
        if (userRole === 'buyer') {
            const savedRes = await fetch(`${API_BASE}/saved-listings/${encodeURIComponent(userEmail)}`);
            const savedData = await savedRes.json();
            savedIds = savedData.listings.map(p => p.id);
        }
        
        container.innerHTML = properties.map(prop => {
            const firstImage = prop.images ? prop.images.split(',')[0] : null;
            const imageHtml = firstImage ? `<img src="/${firstImage}" style="width:100%; height:180px; object-fit:cover; border-radius:12px 12px 0 0;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23666%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">` : `<div style="width:100%; height:180px; background:#222; display:flex; align-items:center; justify-content:center; border-radius:12px 12px 0 0;"><i class="fa-solid fa-image" style="font-size:48px; color:#444;"></i></div>`;
            
            const isSaved = savedIds.includes(prop.id);
            
            let actionButtons = '';
            if (userRole === 'buyer') {
    actionButtons = `
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="btn small" onclick="saveListing(${prop.id})" id="saveBtn_${prop.id}" style="${isSaved ? 'background:#2e7d32; color:white;' : ''}">
                <i class="fa-solid ${isSaved ? 'fa-check' : 'fa-bookmark'}"></i> ${isSaved ? 'Saved' : 'Save'}
            </button>
            <button class="btn small primary" onclick="openInquiryModal(${prop.id}, '${escapeHtml(prop.title)}', '${prop.posted_by}', 'seller')">
                <i class="fa-solid fa-question"></i> Inquire
            </button>
            // Contact agent button (if property has an agent)
if (prop.agent_email) {
    actionButtons += `
        <button class="btn small ghost" onclick="openInquiryModal(null, 'Agent Assistance', '${prop.agent_email}', 'agent')">
            <i class="fa-solid fa-headset"></i> Contact Agent
        </button>
    `;
}
        </div>
    `;
}
            } else if (userRole === 'agent' && prop.posted_by !== userEmail) {
                actionButtons = `
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button class="btn small" onclick="window.location.href='chat.html'">
                             <i class="fa-solid fa-comment"></i> Chat
                        </button>
                        <button class="btn small primary" onclick="openInquiryModal(${prop.id}, '${escapeHtml(prop.title)}', '${prop.posted_by}', 'seller')">
                             <i class="fa-solid fa-question"></i> Inquire
                        </button>
                      </div>
                `;
            } else if (userRole === 'seller' && prop.posted_by === userEmail) {
                actionButtons = `
                    <div style="margin-top: 12px;">
                        <button class="btn small danger" onclick="deleteListing(${prop.id})">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                `;
            }
            
            return `
                <div class="listing-card" style="overflow:hidden;">
                    ${imageHtml}
                    <div style="padding: 16px;">
                        <h3 style="margin:0 0 8px 0;">${escapeHtml(prop.title)}</h3>
                        <p class="property-price" style="font-size:1.25rem; font-weight:bold; margin:8px 0;">P${prop.price?.toLocaleString() || 0}</p>
                        <p style="margin:4px 0;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(prop.location) || 'Botswana'}</p>
                        ${prop.bedrooms ? `<p style="margin:4px 0;"><i class="fa-solid fa-bed"></i> ${prop.bedrooms} beds</p>` : ''}
                        ${prop.bathrooms ? `<p style="margin:4px 0;"><i class="fa-solid fa-bath"></i> ${prop.bathrooms} baths</p>` : ''}
                        <small style="color:#888;">${escapeHtml(prop.description?.substring(0, 100))}...</small>
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading properties</p></div>';
    }
}

// Save listing for buyer
async function saveListing(propertyId) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        alert('Please login to save listings');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/saved-listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer_email: userEmail, property_id: propertyId })
        });
        const result = await response.json();
        if (result.success) {
            const saveBtn = document.getElementById(`saveBtn_${propertyId}`);
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
                saveBtn.style.background = '#2e7d32';
                saveBtn.style.color = 'white';
            }
            alert('✅ Property saved!');
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Error saving');
    }
}

// Open inquiry modal - NOW WORKS FOR AGENTS TOO
function openInquiryModal(propertyId, propertyTitle, ownerEmail, ownerRole) {
    const modal = document.getElementById('inquiryModal');
    if (!modal) return;
    
    document.getElementById('inquiryPropertyId').value = propertyId || '';
    document.getElementById('inquiryPropertyTitle').innerHTML = propertyTitle || 'General Inquiry';
    document.getElementById('inquiryReceiverEmail').value = ownerEmail;
    document.getElementById('inquiryReceiverRole').value = ownerRole || 'seller';
    document.getElementById('inquiryMessage').value = '';
    modal.style.display = 'flex';
}

// Send inquiry - NOW SENDS TO AGENTS, SELLERS, OR BUYERS
async function sendInquiry() {
    const senderEmail = localStorage.getItem('userEmail');
    const senderName = localStorage.getItem('userName') || 'User';
    const senderRole = localStorage.getItem('userRole');
    const receiverEmail = document.getElementById('inquiryReceiverEmail').value;
    const receiverRole = document.getElementById('inquiryReceiverRole').value;
    const propertyId = document.getElementById('inquiryPropertyId').value;
    const message = document.getElementById('inquiryMessage').value;
    
    if (!senderEmail) {
        alert('Please login to send inquiry');
        window.location.href = 'login.html';
        return;
    }
    
    if (!message.trim()) {
        alert('Please enter a message');
        return;
    }
    
    // Inquiries table already has buyer_email and seller_email columns
    // We'll store: sender goes to buyer_email, receiver goes to seller_email
    // For agents, they are treated as "sellers" in the inquiries table
    try {
        const response = await fetch(`${API_BASE}/inquiries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buyer_email: senderEmail,
                seller_email: receiverEmail,
                property_id: propertyId || null,
                message: message
            })
        });
        const result = await response.json();
        if (result.success) {
            alert(`✅ Inquiry sent to ${receiverRole === 'agent' ? 'Agent' : 'Seller'}!`);
            toggleModal('inquiryModal', false);
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Error sending inquiry');
    }
}

// Load inquiries for agent - NEW FUNCTION
async function loadAgentInquiries() {
    const container = document.getElementById('agentInquiriesList');
    if (!container) return;
    const email = localStorage.getItem('userEmail');
    container.innerHTML = '<div class="listing-card">Loading inquiries...</div>';
    try {
        const response = await fetch(`${API_BASE}/inquiries/${encodeURIComponent(email)}`);
        const data = await response.json();
        const inquiries = data.inquiries || [];
        if (inquiries.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No inquiries yet. When buyers or sellers message you, they appear here.</p></div>';
            return;
        }
        container.innerHTML = inquiries.map(i => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4 style="margin:0 0 4px 0;">📩 From: ${escapeHtml(i.buyer_name || i.buyer_email.split('@')[0])}</h4>
                <p><strong>Role:</strong> ${i.buyer_role || 'User'}</p>
                ${i.property_title ? `<p><strong>Property:</strong> ${escapeHtml(i.property_title)}</p>` : ''}
                <p><strong>Message:</strong> "${escapeHtml(i.message)}"</p>
                <p><small>📧 ${escapeHtml(i.buyer_email)}</small></p>
                <button class="btn small" onclick="window.location.href='chat.html'">Reply via Chat</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading inquiries</p></div>';
    }
}

// Load saved listings for buyer modal
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
        container.innerHTML = listings.map(prop => {
            const firstImage = prop.images ? prop.images.split(',')[0] : null;
            const imageHtml = firstImage ? `<img src="/${firstImage}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;" onerror="this.style.display='none'">` : '';
            return `
                <div class="listing-card" style="margin-bottom: 12px; display: flex; gap: 12px;">
                    ${imageHtml ? `<div style="width:100px;">${imageHtml}</div>` : ''}
                    <div style="flex:1;">
                        <h4 style="margin:0 0 4px 0;">${escapeHtml(prop.title)}</h4>
                        <p class="property-price" style="margin:0; font-weight:bold;">P${prop.price?.toLocaleString() || 0}</p>
                        <button class="btn small danger" style="margin-top:8px;" onclick="unsaveListing(${prop.id})">Remove</button>
                    </div>
                </div>
            `;
        }).join('');
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
        // Refresh main properties to update save button states
        const featuredContainer = document.getElementById('featuredListings');
        if (featuredContainer) loadProperties('all', 'featuredListings');
    } catch (error) {
        alert('❌ Error removing');
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
            container.innerHTML = '<div class="listing-card"><p>No inquiries yet. When buyers inquire about your listings, they appear here.</p></div>';
            return;
        }
        container.innerHTML = inquiries.map(i => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4 style="margin:0 0 4px 0;">📩 From: ${escapeHtml(i.buyer_name || i.buyer_email.split('@')[0])}</h4>
                <p><strong>Property:</strong> ${escapeHtml(i.property_title || 'Unknown')}</p>
                <p><strong>Message:</strong> "${escapeHtml(i.message)}"</p>
                <p><small>📧 ${escapeHtml(i.buyer_email)}</small></p>
                <button class="btn small" onclick="window.location.href='chat.html'">Reply via Chat</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading inquiries</p></div>';
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
            <div class="listing-card" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin:0;">${escapeHtml(a.name || a.email.split('@')[0])}</h4>
                    <small>📧 ${escapeHtml(a.email)}</small>
                    ${a.location ? `<small>📍 ${escapeHtml(a.location)}</small>` : ''}
                </div>
                <button class="btn small" onclick="window.location.href='chat.html'">Message</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading agents</p></div>';
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
            <div class="listing-card" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin:0;">${escapeHtml(s.name || s.email.split('@')[0])}</h4>
                    <small>📧 ${escapeHtml(s.email)}</small>
                    ${s.location ? `<small>📍 ${escapeHtml(s.location)}</small>` : ''}
                </div>
                <button class="btn small" onclick="window.location.href='chat.html'">Message</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading sellers</p></div>';
    }
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
    if (!confirm('Delete this listing?')) return;
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/properties/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        alert('✅ Listing deleted');
        loadManagedListings();
        loadProperties('all', 'featuredListings');
    } catch (error) {
        alert('❌ Error deleting');
    }
}

async function deleteListing(id) {
    if (!confirm('Delete this listing?')) return;
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/properties/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        alert('✅ Listing deleted');
        loadProperties('all', 'featuredListings');
        const myListingsContainer = document.getElementById('myListings');
        if (myListingsContainer) loadMyListings();
    } catch (error) {
        alert('❌ Error deleting');
    }
}

async function loadMyListings() {
    const email = localStorage.getItem('userEmail');
    const container = document.getElementById('myListings');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/my-properties/${encodeURIComponent(email)}`);
        const data = await response.json();
        const listings = data.properties || [];
        if (listings.length === 0) {
            container.innerHTML = '<div class="listing-card">No listings yet. Click Create to add one!</div>';
            return;
        }
        container.innerHTML = listings.map(prop => `
            <div class="listing-card">
                <h3>${escapeHtml(prop.title)}</h3>
                <p>Price: P${prop.price?.toLocaleString() || 0}</p>
                <p>Location: ${escapeHtml(prop.location)}</p>
                <button class="btn small danger" onclick="deleteListing(${prop.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card">Error loading listings</div>';
    }
}

// Load connected clients for agent
async function loadConnectedClients() {
    const container = document.getElementById('connectedClientsList');
    if (!container) return;
    const email = localStorage.getItem('userEmail');
    container.innerHTML = '<div class="listing-card">Loading clients...</div>';
    try {
        const response = await fetch(`${API_BASE}/connections/${encodeURIComponent(email)}`);
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

function getCurrentUser() {
    return {
        email: localStorage.getItem('userEmail'),
        name: localStorage.getItem('userName'),
        role: localStorage.getItem('userRole')
    };
}

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

// Post request functions
async function postBuyerRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Buyer';
    const title = document.getElementById('requestTitle')?.value;
    const description = document.getElementById('requestDesc')?.value;
    const type = document.getElementById('requestType')?.value;
    const budget = document.getElementById('requestBudget')?.value;
    const location = document.getElementById('requestLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('newRequest', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
}

async function postSellerRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Seller';
    const title = document.getElementById('sellerRequestTitle')?.value;
    const description = document.getElementById('sellerRequestDesc')?.value;
    const type = document.getElementById('sellerRequestType')?.value;
    const budget = document.getElementById('sellerRequestBudget')?.value;
    const location = document.getElementById('sellerRequestLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('sellerRequest', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
}

async function postAgentRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Agent';
    const title = document.getElementById('agentRequestTitle')?.value;
    const description = document.getElementById('agentRequestDesc')?.value;
    const type = document.getElementById('agentRequestType')?.value;
    const budget = document.getElementById('agentRequestBudget')?.value;
    const location = document.getElementById('agentRequestLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('agentRequest', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
}

// Make functions global
window.toggleModal = toggleModal;
window.openTab = openTab;
window.saveListing = saveListing;
window.unsaveListing = unsaveListing;
window.openInquiryModal = openInquiryModal;
window.sendInquiry = sendInquiry;
window.loadSavedListings = loadSavedListings;
window.loadAgentsList = loadAgentsList;
window.loadSellersList = loadSellersList;
window.loadManagedListings = loadManagedListings;
window.loadConnectedClients = loadConnectedClients;
window.loadInquiries = loadInquiries;
window.loadMyListings = loadMyListings;
window.deleteListing = deleteListing;
window.deleteListingFromModal = deleteListingFromModal;
window.postBuyerRequest = postBuyerRequest;
window.postSellerRequest = postSellerRequest;
window.postAgentRequest = postAgentRequest;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.setupSmartNav = setupSmartNav;

document.addEventListener('DOMContentLoaded', () => {
    setupSmartNav();
});