// global.js - HouseHunters COMPLETE (NO IMAGES)
const API_BASE = 'https://househunters-backend-1.onrender.com/api';

console.log('=== GLOBAL.JS LOADED ===');

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

// Load properties
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
        
        let savedIds = [];
        if (userRole === 'buyer') {
            try {
                const savedRes = await fetch(`${API_BASE}/saved-listings/${encodeURIComponent(userEmail)}`);
                const savedData = await savedRes.json();
                savedIds = savedData.listings?.map(p => p.id) || [];
            } catch(e) { console.log('Error loading saved IDs'); }
        }
        
        container.innerHTML = properties.map(prop => {
            const isSaved = savedIds.includes(prop.id);
            const isOwner = prop.posted_by === userEmail;
            
            let actionButtons = '';
            
            if (userRole === 'buyer') {
                actionButtons = `
                    <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
                        <button type="button" class="btn small" onclick="window.saveListing(${prop.id})" id="saveBtn_${prop.id}" style="${isSaved ? 'background:#2e7d32; color:white;' : ''}">
                            <i class="fa-solid ${isSaved ? 'fa-check' : 'fa-bookmark'}"></i> ${isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button type="button" class="btn small" onclick="window.startChat('${prop.posted_by}', '${escapeHtml(prop.title)}')">
                            <i class="fa-solid fa-comment"></i> Chat
                        </button>
                        <button type="button" class="btn small primary" onclick="window.openInquiryModal(${prop.id}, '${escapeHtml(prop.title)}', '${prop.posted_by}', 'seller')">
                            <i class="fa-solid fa-question"></i> Inquire
                        </button>
                    </div>
                `;
            } 
            else if (userRole === 'seller') {
                if (isOwner) {
                    actionButtons = `
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button type="button" class="btn small danger" onclick="window.deleteListing(${prop.id})">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </div>
                    `;
                } else {
                    actionButtons = `
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button type="button" class="btn small" onclick="window.startChat('${prop.posted_by}', '${escapeHtml(prop.title)}')">
                                <i class="fa-solid fa-comment"></i> Chat
                            </button>
                            <button type="button" class="btn small primary" onclick="window.openInquiryModal(${prop.id}, '${escapeHtml(prop.title)}', '${prop.posted_by}', 'seller')">
                                <i class="fa-solid fa-question"></i> Inquire
                            </button>
                        </div>
                    `;
                }
            }
            else if (userRole === 'agent') {
                if (isOwner) {
                    actionButtons = `
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button type="button" class="btn small danger" onclick="window.deleteListing(${prop.id})">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </div>
                    `;
                } else {
                    actionButtons = `
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button type="button" class="btn small" onclick="window.startChat('${prop.posted_by}', '${escapeHtml(prop.title)}')">
                                <i class="fa-solid fa-comment"></i> Chat
                            </button>
                            <button type="button" class="btn small primary" onclick="window.openInquiryModal(${prop.id}, '${escapeHtml(prop.title)}', '${prop.posted_by}', 'seller')">
                                <i class="fa-solid fa-question"></i> Inquire
                            </button>
                        </div>
                    `;
                }
            }
            
            return `
                <div class="listing-card" style="overflow:hidden; cursor: pointer;" onclick="window.viewListingDetail(${prop.id})">
                    <div style="padding: 16px;">
                        <h3 style="margin:0 0 8px 0;">${escapeHtml(prop.title)}</h3>
                        <p class="property-price" style="font-size:1.25rem; font-weight:bold; margin:8px 0;">P${prop.price?.toLocaleString() || 0}</p>
                        <p style="margin:4px 0;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(prop.location) || 'Botswana'}</p>
                        ${prop.bedrooms ? `<p style="margin:4px 0;"><i class="fa-solid fa-bed"></i> ${prop.bedrooms} beds</p>` : ''}
                        ${prop.bathrooms ? `<p style="margin:4px 0;"><i class="fa-solid fa-bath"></i> ${prop.bathrooms} baths</p>` : ''}
                        <small style="color:#888;">${escapeHtml(prop.description?.substring(0, 100))}...</small>
                        <div>
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Load properties error:', error);
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading properties</p></div>';
    }
}

// View listing detail
async function viewListingDetail(propertyId) {
    try {
        const response = await fetch(`${API_BASE}/properties/${propertyId}`);
        const data = await response.json();
        const prop = data.property;
        
        if (!prop) {
            alert('Property not found');
            return;
        }
        
        const modalHtml = `
            <div id="detailModal" class="modal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                    <button class="close-btn" onclick="window.closeDetailModal()" style="position: absolute; top: 10px; right: 10px;">×</button>
                    <div style="text-align: center;">
                        <h2>${escapeHtml(prop.title)}</h2>
                        <p class="property-price" style="font-size: 24px; font-weight: bold;">P${prop.price?.toLocaleString() || 0}</p>
                        <p><i class="fa-solid fa-location-dot"></i> ${escapeHtml(prop.location) || 'Botswana'}</p>
                        ${prop.bedrooms ? `<p><i class="fa-solid fa-bed"></i> ${prop.bedrooms} bedrooms</p>` : ''}
                        ${prop.bathrooms ? `<p><i class="fa-solid fa-bath"></i> ${prop.bathrooms} bathrooms</p>` : ''}
                        ${prop.area ? `<p><i class="fa-solid fa-arrows-up-down-left-right"></i> ${prop.area} m²</p>` : ''}
                        <hr style="border-color: #333; margin: 16px 0;">
                        <h3>Description</h3>
                        <p style="text-align: left;">${escapeHtml(prop.description)}</p>
                        <hr style="border-color: #333; margin: 16px 0;">
                        <p><small>Posted by: ${escapeHtml(prop.posted_by)}</small></p>
                        <p><small>Listed on: ${new Date(prop.created_at).toLocaleDateString()}</small></p>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('detailModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error loading property details:', error);
        alert('Error loading property details');
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

// Start chat - FIXED: Creates initial message to start conversation
async function startChat(receiverEmail, propertyTitle) {
    console.log('startChat called with:', receiverEmail, propertyTitle);
    const currentUser = localStorage.getItem('userEmail');
    if (!currentUser) {
        alert('Please login to chat');
        window.location.href = 'login.html';
        return;
    }
    
    if (currentUser === receiverEmail) {
        alert('You cannot chat with yourself');
        return;
    }
    
    // Store receiver info
    localStorage.setItem('chatReceiver', receiverEmail);
    if (propertyTitle) {
        localStorage.setItem('chatPropertyTitle', propertyTitle);
    }
    
    // FIRST: Send an initial message to create the conversation
    const initialMessage = `Hi! I'm interested in your property: ${propertyTitle}`;
    
    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sender: currentUser, 
                receiver: receiverEmail, 
                message: initialMessage 
            })
        });
        const result = await response.json();
        console.log('Initial message sent:', result);
        
        // Also send an inquiry to notify the seller
        await fetch(`${API_BASE}/inquiries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buyer_email: currentUser,
                seller_email: receiverEmail,
                property_id: null,
                message: `Interested in property: ${propertyTitle}`
            })
        });
        
    } catch(error) {
        console.error('Error sending initial message:', error);
    }
    
    // Redirect to chat page
    window.location.href = 'chat.html';
}
// Save listing
async function saveListing(propertyId) {
    console.log('saveListing called for property:', propertyId);
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
        console.error('Save error:', error);
        alert('❌ Error saving');
    }
}

async function unsaveListing(propertyId) {
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/saved-listings/${email}/${propertyId}`, { method: 'DELETE' });
        alert('✅ Removed from saved');
        loadSavedListings();
        const featuredContainer = document.getElementById('featuredListings');
        if (featuredContainer) loadProperties('all', 'featuredListings');
    } catch (error) {
        alert('❌ Error removing');
    }
}

// Inquiry
function openInquiryModal(propertyId, propertyTitle, ownerEmail, ownerRole) {
    console.log('openInquiryModal called:', propertyId, propertyTitle);
    const modal = document.getElementById('inquiryModal');
    if (!modal) {
        console.error('inquiryModal not found');
        alert('Modal not found. Please refresh the page.');
        return;
    }
    
    document.getElementById('inquiryPropertyId').value = propertyId || '';
    document.getElementById('inquiryPropertyTitle').innerHTML = propertyTitle || 'General Inquiry';
    document.getElementById('inquiryReceiverEmail').value = ownerEmail;
    document.getElementById('inquiryReceiverRole').value = ownerRole || 'seller';
    document.getElementById('inquiryMessage').value = '';
    modal.style.display = 'flex';
}

async function sendInquiry() {
    const senderEmail = localStorage.getItem('userEmail');
    const receiverEmail = document.getElementById('inquiryReceiverEmail').value;
    const propertyId = document.getElementById('inquiryPropertyId').value;
    const message = document.getElementById('inquiryMessage').value;
    const receiverRole = document.getElementById('inquiryReceiverRole').value;
    
    if (!senderEmail) {
        alert('Please login to send inquiry');
        window.location.href = 'login.html';
        return;
    }
    
    if (!message.trim()) {
        alert('Please enter a message');
        return;
    }
    
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

async function loadSavedListings() {
    const container = document.getElementById('savedContainer');
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
                <p>📍 ${escapeHtml(prop.location) || 'Botswana'}</p>
                <button class="btn small danger" onclick="unsaveListing(${prop.id})">Remove</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>⚠️ Error loading saved listings</p></div>';
    }
}

async function loadAgentsList() {
    const container = document.getElementById('agentsContainer');
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

async function loadSellersList() {
    const container = document.getElementById('sellersContainer');
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

async function loadSellerAgentsList() {
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
                </div>
                <button class="btn small" onclick="window.location.href='chat.html'">Message</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>Error loading agents</p></div>';
    }
}

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

async function loadManagedListings() {
    const email = localStorage.getItem('userEmail');
    const container = document.getElementById('myListingsContainer');
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
                <p>P${prop.price?.toLocaleString() || 0}</p>
                <button class="btn small danger" onclick="deleteAgentListing(${prop.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>Error loading listings</p></div>';
    }
}

async function loadConnectedClients() {
    const container = document.getElementById('clientsContainer');
    if (!container) return;
    const email = localStorage.getItem('userEmail');
    container.innerHTML = '<div class="listing-card">Loading clients...</div>';
    try {
        const response = await fetch(`${API_BASE}/connections/${encodeURIComponent(email)}`);
        const data = await response.json();
        const clients = data.connections || [];
        if (clients.length === 0) {
            container.innerHTML = '<div class="listing-card"><p>No connected clients yet.</p></div>';
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
        container.innerHTML = '<div class="listing-card"><p>Error loading clients</p></div>';
    }
}

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
            container.innerHTML = '<div class="listing-card"><p>No inquiries yet.</p></div>';
            return;
        }
        container.innerHTML = inquiries.map(i => `
            <div class="listing-card" style="margin-bottom: 12px;">
                <h4>📩 From: ${escapeHtml(i.buyer_name || i.buyer_email.split('@')[0])}</h4>
                <p><strong>Message:</strong> "${escapeHtml(i.message)}"</p>
                <p><small>📧 ${escapeHtml(i.buyer_email)}</small></p>
                <button class="btn small" onclick="window.location.href='chat.html'">Reply</button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="listing-card"><p>Error loading inquiries</p></div>';
    }
}

async function deleteAgentListing(id) {
    if (!confirm('Delete this listing?')) return;
    const email = localStorage.getItem('userEmail');
    try {
        await fetch(`${API_BASE}/properties/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        alert('✅ Deleted');
        loadManagedListings();
        loadProperties('all', 'featuredListings');
    } catch (error) { alert('Error'); }
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
        alert('✅ Deleted');
        loadProperties('all', 'featuredListings');
        if (document.getElementById('myListings')) loadMyListings();
    } catch (error) { alert('Error'); }
}

async function postBuyerRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Buyer';
    const title = document.getElementById('reqTitle')?.value;
    const description = document.getElementById('reqDesc')?.value;
    const type = document.getElementById('reqType')?.value;
    const budget = document.getElementById('reqBudget')?.value;
    const location = document.getElementById('reqLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('requestModal', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
}

async function postSellerRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Seller';
    const title = document.getElementById('reqTitle')?.value;
    const description = document.getElementById('reqDesc')?.value;
    const type = document.getElementById('reqType')?.value;
    const budget = document.getElementById('reqBudget')?.value;
    const location = document.getElementById('reqLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('requestModal', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
}

async function postAgentRequest() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Agent';
    const title = document.getElementById('reqTitle')?.value;
    const description = document.getElementById('reqDesc')?.value;
    const type = document.getElementById('reqType')?.value;
    const budget = document.getElementById('reqBudget')?.value;
    const location = document.getElementById('reqLocation')?.value;
    if (!title || !description) { alert('Please fill title and description'); return; }
    try {
        const response = await fetch(`${API_BASE}/requests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, type, budget, location, contactName: userName, postedBy: userEmail })
        });
        const result = await response.json();
        if (result.success) { alert('✅ Request posted!'); toggleModal('requestModal', false); }
        else alert('❌ ' + result.message);
    } catch (error) { alert('Network error'); }
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
    const homeLinks = { buyer: 'buyer.html', seller: 'seller.html', agent: 'agent.html' };
    const homeLink = homeLinks[role];
    const homeBtn = document.getElementById('smartHomeBtn');
    if (homeBtn) homeBtn.href = homeLink;
    
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        } else if (item.id === 'smartHomeBtn' && currentPage === homeLink) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function applyTheme(isDark) {
    if (isDark) {
        document.body.style.backgroundColor = '#000000';
        document.body.style.color = '#ffffff';
        
        document.querySelectorAll('.listing-card, .profile-card, .settings-card, .auth-card, .modal-content, .chat-item, .form-card').forEach(el => {
            if (el) {
                el.style.backgroundColor = '#1a1a1a';
                el.style.borderColor = '#2e2f32';
            }
        });
        
        document.querySelectorAll('.app-header, .bottom-nav, .sidebar, .chat-area, .chat-input').forEach(el => {
            if (el) {
                el.style.backgroundColor = '#111111';
                el.style.borderColor = '#2e2f32';
            }
        });
        
        document.querySelectorAll('.btn:not(.primary)').forEach(el => {
            el.style.backgroundColor = '#2a2a2a';
            el.style.borderColor = '#444444';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.btn.primary').forEach(el => {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.cat').forEach(el => {
            el.style.backgroundColor = '#2a2a2a';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.cat.active').forEach(el => {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('input, textarea, select').forEach(el => {
            el.style.backgroundColor = '#1a1a1a';
            el.style.borderColor = '#3e3f42';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.message.sent .bubble').forEach(el => {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.message.received .bubble').forEach(el => {
            el.style.backgroundColor = '#2a2a2a';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.nav-item').forEach(el => {
            el.style.color = '#6c6f72';
        });
        
        document.querySelectorAll('.nav-item.active').forEach(el => {
            el.style.color = '#ffffff';
        });
        
    } else {
        document.body.style.backgroundColor = '#f5f5f5';
        document.body.style.color = '#000000';
        
        document.querySelectorAll('.listing-card, .profile-card, .settings-card, .auth-card, .modal-content, .chat-item, .form-card').forEach(el => {
            if (el) {
                el.style.backgroundColor = '#ffffff';
                el.style.borderColor = '#e0e0e0';
            }
        });
        
        document.querySelectorAll('.app-header, .bottom-nav, .sidebar, .chat-area, .chat-input').forEach(el => {
            if (el) {
                el.style.backgroundColor = '#ffffff';
                el.style.borderColor = '#e0e0e0';
            }
        });
        
        document.querySelectorAll('.btn:not(.primary)').forEach(el => {
            el.style.backgroundColor = '#f0f0f0';
            el.style.borderColor = '#cccccc';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.btn.primary').forEach(el => {
            el.style.backgroundColor = '#000000';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.cat').forEach(el => {
            el.style.backgroundColor = '#e0e0e0';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.cat.active').forEach(el => {
            el.style.backgroundColor = '#000000';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('input, textarea, select').forEach(el => {
            el.style.backgroundColor = '#ffffff';
            el.style.borderColor = '#cccccc';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.message.sent .bubble').forEach(el => {
            el.style.backgroundColor = '#000000';
            el.style.color = '#ffffff';
        });
        
        document.querySelectorAll('.message.received .bubble').forEach(el => {
            el.style.backgroundColor = '#e0e0e0';
            el.style.color = '#000000';
        });
        
        document.querySelectorAll('.nav-item').forEach(el => {
            el.style.color = '#999999';
        });
        
        document.querySelectorAll('.nav-item.active').forEach(el => {
            el.style.color = '#000000';
        });
    }
}

function initTheme() {
    const isDark = localStorage.getItem('darkMode') !== 'false';
    applyTheme(isDark);
    
    const darkModeSwitch = document.getElementById('darkModeSwitch');
    if (darkModeSwitch) {
        darkModeSwitch.checked = isDark;
    }
}

// ============ FORCE ALL FUNCTIONS TO BE GLOBAL ============
window.saveListing = saveListing;
window.startChat = startChat;
window.openInquiryModal = openInquiryModal;
window.sendInquiry = sendInquiry;
window.deleteListing = deleteListing;
window.viewListingDetail = viewListingDetail;
window.closeDetailModal = closeDetailModal;
window.toggleModal = toggleModal;
window.openTab = openTab;
window.unsaveListing = unsaveListing;
window.loadSavedListings = loadSavedListings;
window.loadAgentsList = loadAgentsList;
window.loadSellersList = loadSellersList;
window.loadManagedListings = loadManagedListings;
window.loadConnectedClients = loadConnectedClients;
window.loadInquiries = loadInquiries;
window.loadMyListings = loadMyListings;
window.loadSellerAgentsList = loadSellerAgentsList;
window.loadAgentInquiries = loadAgentInquiries;
window.deleteAgentListing = deleteAgentListing;
window.postBuyerRequest = postBuyerRequest;
window.postSellerRequest = postSellerRequest;
window.postAgentRequest = postAgentRequest;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.setupSmartNav = setupSmartNav;
window.initTheme = initTheme;
window.applyTheme = applyTheme;

console.log('✅ All functions registered to window object');
console.log('✅ startChat available:', typeof window.startChat === 'function');
console.log('✅ saveListing available:', typeof window.saveListing === 'function');
console.log('✅ openInquiryModal available:', typeof window.openInquiryModal === 'function');

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        setupSmartNav();
    });
} else {
    initTheme();
    setupSmartNav();
}
