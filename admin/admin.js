
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, where, getDocs, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL, uploadBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { firebaseConfig } from '../js/firebase-config.js';


// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// State
let currentUser = null;
let requests = [];
let customers = {}; // Cache: { id: { name, email } }
let currentView = 'board'; // 'list' or 'board'
let currentQuoteRequest = null;
let currentQuoteItems = [];
let selectedCustomerIds = new Set(); // ADDED for bulk delete
let orders = []; // ADDED for Milestone 4

// DOM Elements
const els = {
    loading: document.getElementById('loading-overlay'),
    authView: document.getElementById('auth-view'),
    dashboardView: document.getElementById('dashboard-view'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    userEmail: document.getElementById('user-email-display'),
    logoutBtn: document.getElementById('logout-btn'),
    // Requests View
    btnViewList: document.getElementById('view-list'),
    btnViewBoard: document.getElementById('view-board'),
    btnViewCalendar: document.getElementById('view-calendar'),
    requestsListView: document.getElementById('requests-list-view'),
    requestsBoardView: document.getElementById('requests-board-view'),
    requestsCalendarView: document.getElementById('requests-calendar-view'), // ADDED
    calTitle: document.getElementById('cal-title'),
    calPrev: document.getElementById('cal-prev'),
    calNext: document.getElementById('cal-next'),
    calGrid: document.getElementById('calendar-grid'),
    tableBody: document.getElementById('requests-table-body'),
    boardColumns: {
        NEW: document.getElementById('col-NEW'),
        AWAITING_DETAILS: document.getElementById('col-AWAITING_DETAILS'), // ADDED
        QUOTING: document.getElementById('col-QUOTING'),
        BOOKED: document.getElementById('col-BOOKED'),
        COMPLETED: document.getElementById('col-COMPLETED')
    },
    // Stats
    countNew: document.getElementById('count-new'),
    countPending: document.getElementById('count-pending'),
    countTotal: document.getElementById('count-total'),
    emptyState: document.getElementById('empty-state'),
    refreshBtn: document.getElementById('refresh-requests'),
    // Modal
    modal: document.getElementById('detail-modal'),
    modalBody: document.getElementById('modal-body'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
    // Quote Modal
    quoteModal: document.getElementById('quote-modal'),
    quoteCustName: document.getElementById('quote-cust-name'),
    quoteReqId: document.getElementById('quote-req-id'),
    quoteItemsBody: document.getElementById('quote-items-body'),
    btnAddItem: document.getElementById('btn-add-item'),
    quoteSubtotal: document.getElementById('quote-subtotal'),
    quoteDelivery: document.getElementById('quote-delivery'),
    quoteRush: document.getElementById('quote-rush'),
    quoteTotal: document.getElementById('quote-total'),
    quoteResult: document.getElementById('quote-result'),
    quotePdfLink: document.getElementById('quote-pdf-link'),
    btnGeneratePdf: document.getElementById('btn-generate-pdf'),
    btnSendEmail: document.getElementById('btn-send-email'),
    // Customers View
    customerSearch: document.getElementById('customer-search'),
    customersTableBody: document.getElementById('customers-table-body'),
    customersEmptyState: document.getElementById('customers-empty-state'),
    // Bulk Delete
    btnDeleteSelected: document.getElementById('btn-delete-selected'),
    selectedCountSpan: document.getElementById('selected-count'),
    selectAllCheckbox: document.getElementById('select-all-customers'),
    // Customer Modal
    customerModal: document.getElementById('customer-modal'),
    editCustId: document.getElementById('edit-cust-id'),
    editCustName: document.getElementById('edit-cust-name'),
    editCustEmail: document.getElementById('edit-cust-email'),
    editCustPhone: document.getElementById('edit-cust-phone'),
    btnSaveCustomer: document.getElementById('btn-save-customer'),
    // Manual Entry
    btnNewRequest: document.getElementById('btn-new-request'),
    btnAddCustomer: document.getElementById('btn-add-customer'),
    newReqModal: document.getElementById('new-request-modal'),
    newReqForm: document.getElementById('new-req-form'),
    newReqCustomer: document.getElementById('new-req-customer'),
    linkCreateCustInline: document.getElementById('link-create-cust-inline'),
    // Visualization
    globalSearch: document.getElementById('global-search'),
    custHistoryList: document.getElementById('cust-history-list'),
    // Stats - Revenue
    countRevenue: document.getElementById('count-revenue'),
    // Record Deposit
    btnRecordDeposit: document.getElementById('btn-record-deposit'),
    depositModal: document.getElementById('deposit-modal'),
    depositForm: document.getElementById('deposit-form'),
    depositReqId: document.getElementById('deposit-req-id'),
    depositCustId: document.getElementById('deposit-cust-id'),
    depositTotal: document.getElementById('deposit-total'),
    depositAmount: document.getElementById('deposit-amount'),
    depositNote: document.getElementById('deposit-note'),
    // Mobile Nav
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebar: document.querySelector('.sidebar')
};

// --- AUTH LOGIC ---

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        initDashboard(user);
    } else {
        showLogin();
    }
    // Fade out loading
    setTimeout(() => {
        els.loading.classList.add('fade-out');
    }, 500);
});

function showLogin() {
    els.authView.classList.remove('hidden');
    els.dashboardView.classList.add('hidden');
}

async function initDashboard(user) {
    els.authView.classList.add('hidden');
    els.dashboardView.classList.remove('hidden');
    els.userEmail.textContent = user.email;

    // Initial Load
    // Initial Load
    await fetchRequests();

    // Force Board View Default
    switchView('board');

    // Init Drag and Drop
    initDragAndDrop();

    // Init Quote Logic
    initQuoteLogic();

    // Init Customers
    initCustomersLogic();
    await fetchAllCustomers();

    // Init Manual Entry
    initNewRequestLogic();

    // Init Record Deposit (Milestone 4)
    initRecordDepositLogic();

    // Init Analytics (Milestone 5)
    initAnalyticsLogic();

    // Init Deposit Modal Close Button (User Feedback Fix)
    const depositCloseBtn = els.depositModal.querySelector('.close-modal');
    if (depositCloseBtn) {
        depositCloseBtn.addEventListener('click', () => {
            els.depositModal.classList.add('hidden');
        });
    }

    await fetchOrders(); // Fetch orders for revenue stats

    // Init Global Search
    if (els.globalSearch) {
        els.globalSearch.addEventListener('input', () => {
            renderTable();
            renderBoard();
        });
    }
}

els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.loginError.textContent = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error);
        els.loginError.textContent = `Error: ${error.code} - ${error.message}`;
        alert(`Login Error Detail:\nCode: ${error.code}\nMessage: ${error.message}`);
    }
});

const togglePasswordBtn = document.getElementById('toggle-password');
if (togglePasswordBtn) {
    // Ensure button is clickable over input
    togglePasswordBtn.style.zIndex = "10";
    togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent accidental submits
        const passwordInput = document.getElementById('password');
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Update Icon
        if (type === 'text') {
            togglePasswordBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path></svg>';
        } else {
            togglePasswordBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    });
}

const forgotPasswordBtn = document.getElementById('forgot-password-btn');
if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('email');
        const email = emailInput.value;
        if (!email) {
            alert("Please enter your email address in the box above first.");
            emailInput.focus();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            // With Email Enumeration Protection, this may succeed even if email is not found.
            alert(`If an account exists for ${email}, a password reset link has been sent. Please check your inbox and spam folder.`);
        } catch (error) {
            console.error("Reset Error:", error);
            let msg = "Error sending reset email.";
            if (error.code === 'auth/user-not-found') {
                msg = "No admin account found with this email.";
            } else if (error.code === 'auth/invalid-email') {
                msg = "Invalid email address format.";
            }
            alert(msg + "\n\n(Technical: " + error.message + ")");
        }
    });
}

els.logoutBtn.addEventListener('click', () => {
    signOut(auth);
});


// --- NAVIGATION LOGIC ---

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // Remove active class from all
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        // Add to current
        e.currentTarget.parentElement.classList.add('active'); // Use currentTarget

        const pageName = e.currentTarget.dataset.page; // Use currentTarget
        showPage(pageName);

        // Close Mobile Menu
        if (window.innerWidth <= 768) {
            els.sidebar.classList.remove('open');
            els.sidebarOverlay.classList.remove('active');
        }
    });
});

// --- MOBILE MENU LOGIC ---
if (els.mobileMenuBtn) {
    els.mobileMenuBtn.addEventListener('click', () => {
        els.sidebar.classList.add('open');
        els.sidebarOverlay.classList.add('active');
    });
}

if (els.sidebarOverlay) {
    els.sidebarOverlay.addEventListener('click', () => {
        els.sidebar.classList.remove('open');
        els.sidebarOverlay.classList.remove('active');
    });
}

function showPage(pageName) {
    // Hide all main pages
    document.getElementById('page-requests').classList.add('hidden');
    document.getElementById('page-customers').classList.add('hidden');
    const analyticsPage = document.getElementById('page-analytics');
    if (analyticsPage) analyticsPage.classList.add('hidden');
    const galleryPage = document.getElementById('page-gallery');
    if (galleryPage) galleryPage.classList.add('hidden');

    // Show target
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.remove('hidden');

    // Initialize page-specific data
    if (pageName === 'gallery') {
        initGallery();
    }
}


// --- VIEW SWITCHING ---

let currentCalDate = new Date(); // State for Calendar

els.btnViewList.addEventListener('click', () => switchView('list'));
els.btnViewBoard.addEventListener('click', () => switchView('board'));
if (els.btnViewCalendar) els.btnViewCalendar.addEventListener('click', () => switchView('calendar'));

if (els.calPrev) els.calPrev.addEventListener('click', () => changeCalMonth(-1));
if (els.calNext) els.calNext.addEventListener('click', () => changeCalMonth(1));

function switchView(view) {
    currentView = view;

    // Reset buttons
    els.btnViewList.classList.remove('active');
    els.btnViewBoard.classList.remove('active');
    if (els.btnViewCalendar) els.btnViewCalendar.classList.remove('active');

    // Hide Views
    els.requestsListView.classList.add('hidden');
    els.requestsBoardView.classList.add('hidden');
    if (els.requestsCalendarView) els.requestsCalendarView.classList.add('hidden');

    if (view === 'list') {
        els.btnViewList.classList.add('active');
        els.requestsListView.classList.remove('hidden');
    } else if (view === 'board') {
        els.btnViewBoard.classList.add('active');
        els.requestsBoardView.classList.remove('hidden');
    } else if (view === 'calendar') {
        if (els.btnViewCalendar) els.btnViewCalendar.classList.add('active');
        if (els.requestsCalendarView) els.requestsCalendarView.classList.remove('hidden');
        renderCalendar();
    }
}

function changeCalMonth(delta) {
    currentCalDate.setMonth(currentCalDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    if (!els.calGrid) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    // Update Title
    els.calTitle.textContent = currentCalDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

    // Clear Grid (keep headers)
    const headers = els.calGrid.querySelectorAll('.cal-day-header');
    els.calGrid.innerHTML = '';
    headers.forEach(h => els.calGrid.appendChild(h));

    // Calculate Days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // 0 = Sun

    // Empty cells before start
    for (let i = 0; i < startDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day empty';
        els.calGrid.appendChild(cell);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.innerHTML = `<div class="day-num">${day}</div>`;

        // Find events
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Filter requests for this date
        const events = requests.filter(r => {
            return r.step1_data && r.step1_data.event_date === dateStr;
        });

        events.forEach(req => {
            const eventEl = document.createElement('div');
            eventEl.className = `cal-event status-${req.status}`;
            eventEl.textContent = `${customers[req.customer_id]?.name || 'Unknown'} - ${req.step1_data.category}`;
            eventEl.title = `${req.status}`;
            eventEl.onclick = () => openModal(req.id);
            cell.appendChild(eventEl);
        });

        els.calGrid.appendChild(cell);
    }
}

// --- DASHBOARD DATA ---

els.refreshBtn.addEventListener('click', async () => {
    // Visual feedback
    const icon = els.refreshBtn.querySelector('svg');
    icon.style.animation = "spin 1s linear infinite";
    els.refreshBtn.disabled = true;

    await fetchRequests();

    // Stop animation
    setTimeout(() => {
        icon.style.animation = "";
        els.refreshBtn.disabled = false;
    }, 500);
});

let unsubscribeRequests = null;

async function fetchRequests() {
    if (unsubscribeRequests) unsubscribeRequests();

    const q = query(collection(db, "requests"), orderBy("created_at", "desc"));

    unsubscribeRequests = onSnapshot(q, async (snapshot) => {
        requests = [];
        const missingCustomerIds = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            // Normalize status just in case
            if (!data.status) data.status = 'NEW';

            requests.push(data);
            if (data.customer_id && !customers[data.customer_id]) {
                missingCustomerIds.add(data.customer_id);
            }
        });

        // Batch fetch missing customers
        if (missingCustomerIds.size > 0) {
            const ids = Array.from(missingCustomerIds);
            const chunks = chunkArray(ids, 10);

            for (const chunk of chunks) {
                await Promise.all(chunk.map(fetchCustomer));
            }
        }

        renderTable();
        renderBoard();
        updateStats();
    }, (error) => {
        console.error("Error fetching requests:", error);
        if (error.code === 'permission-denied') {
            alert("Permissions Error: Ensure you are logged in as an admin.");
        }
    });
}

function updateStats() {
    const newCount = requests.filter(r => r.status === 'NEW').length;
    const pendingCount = requests.filter(r => ['AWAITING_DETAILS', 'QUOTING'].includes(r.status)).length;
    const totalCount = requests.length;

    if (els.countNew) els.countNew.textContent = newCount;
    if (els.countPending) els.countPending.textContent = pendingCount;
    if (els.countTotal) els.countTotal.textContent = totalCount;

    // Revenue Stat (Milestone 4 - Refined: Cash Collected)
    if (els.countRevenue) {
        // Sum of all payments (approximated by 'amount_paid' on order doc, 
        // assuming we maintain that field. Or we can default to total_price if paid is missing for backward compat)
        const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.amount_paid) || 0), 0);
        els.countRevenue.textContent = `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    // Update Analytics Charts if available
    if (typeof updateCharts === 'function') {
        updateCharts();
    }
}

let unsubscribeOrders = null;

async function fetchOrders() {
    if (unsubscribeOrders) unsubscribeOrders();
    const q = query(collection(db, "orders")); // Simple fetch all for now
    unsubscribeOrders = onSnapshot(q, (snapshot) => {
        orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        updateStats();
    }, (error) => {
        console.error("Error fetching orders:", error);
    });
}


async function fetchCustomer(id) {
    if (customers[id]) return;
    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            customers[id] = docSnap.data();
        } else {
            customers[id] = { name: "Unknown" };
        }
    } catch (e) {
        console.error("Error loading customer", id, e);
        customers[id] = { name: "Error" };
    }
}

function renderTable() {
    els.tableBody.innerHTML = '';

    // Filter Requests
    const term = els.globalSearch ? els.globalSearch.value.toLowerCase() : '';
    const filtered = requests.filter(req => {
        if (!term) return true;
        const custName = customers[req.customer_id] ? customers[req.customer_id].name.toLowerCase() : '';
        const custEmail = customers[req.customer_id] ? customers[req.customer_id].email.toLowerCase() : '';
        const id = req.id.toLowerCase();
        return custName.includes(term) || custEmail.includes(term) || id.includes(term);
    });

    if (filtered.length === 0) {
        els.emptyState.classList.remove('hidden');
        return;
    }
    els.emptyState.classList.add('hidden');

    filtered.forEach(req => {
        const tr = document.createElement('tr');

        // Data prep
        const date = req.created_at ? new Date(req.created_at.seconds * 1000).toLocaleDateString() : 'N/A';
        const custName = customers[req.customer_id] ? customers[req.customer_id].name : 'Loading...';
        const eventDate = req.step1_data?.event_date || '-';
        const type = req.step1_data?.category || '-';
        const status = req.status || 'NEW';

        tr.innerHTML = `
            <td>${date}</td>
            <td><strong>${custName}</strong></td>
            <td>${eventDate}</td>
            <td>${type}</td>
            <td><span class="status-badge status-${status}">${status}</span></td>
            <td>
                <button class="btn-sm btn-view" data-id="${req.id}">View</button>
            </td>
        `;

        els.tableBody.appendChild(tr);
    });

    // Re-attach listeners
    els.tableBody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn.dataset.id));
    });
}


function renderBoard() {
    // Ensure ALL columns are found (Lazy re-fetch if any are missing)
    if (!els.boardColumns.NEW || !els.boardColumns.AWAITING_DETAILS || !els.boardColumns.QUOTING) {
        console.log("Re-fetching board columns...");
        els.boardColumns.NEW = document.getElementById('col-NEW');
        els.boardColumns.AWAITING_DETAILS = document.getElementById('col-AWAITING_DETAILS');
        els.boardColumns.QUOTING = document.getElementById('col-QUOTING');
        els.boardColumns.BOOKED = document.getElementById('col-BOOKED');
        els.boardColumns.COMPLETED = document.getElementById('col-COMPLETED');
    }

    // Verify critical elements exists
    if (!els.boardColumns.NEW) {
        console.error("Board columns not found in DOM");
        return;
    }

    // Clear columns
    Object.values(els.boardColumns).forEach(col => {
        if (col) col.innerHTML = '';
    });

    console.log(`Rendering Board. Total Requests: ${requests.length}`);

    // Filter Requests
    const term = els.globalSearch ? els.globalSearch.value.toLowerCase() : '';
    const filtered = requests.filter(req => {
        if (!term) return true;
        const custName = customers[req.customer_id] ? customers[req.customer_id].name.toLowerCase() : '';
        const custEmail = customers[req.customer_id] ? customers[req.customer_id].email.toLowerCase() : '';
        const id = req.id.toLowerCase();
        return custName.includes(term) || custEmail.includes(term) || id.includes(term);
    });

    filtered.forEach(req => {
        // Robust status normalization
        let rawStatus = req.status || 'NEW';
        if (typeof rawStatus !== 'string') rawStatus = 'NEW';
        const status = rawStatus.trim().toUpperCase();

        // Debug log for tricky statuses
        // console.log(`Req ${req.id} status: ${status}`);

        // Skip if status not in our columns (e.g. DECLINED or custom)
        if (!els.boardColumns[status]) {
            console.warn("Skipping request with unknown status:", status, req.id);
            return;
        }

        const custName = customers[req.customer_id] ? customers[req.customer_id].name : 'Loading...';

        let date = 'N/A';
        if (req.created_at) {
            // Handle both Firestore Timestamp and plain strings/dates if mismatched
            const seconds = req.created_at.seconds || (new Date(req.created_at).getTime() / 1000);
            if (seconds) {
                date = new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }
        }

        // Determine Icon based on Category
        const cat = (req.step1_data?.category || '').toLowerCase();
        let iconPath = '';
        /* SVG Paths (Better Quality) */
        if (cat.includes('cake') && !cat.includes('cup')) {
            // Cake Slice Icon
            iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16s.5-1 2-1 2.5 1 4 1 2.5-1 4-1 2.5 1 4 1 2-1 2-1"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2 21h20"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8v2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 8v2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 4h.01"/>';
        } else if (cat.includes('cupcake') || cat.includes('cup')) {
            // Cupcake Icon
            iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 21c-1.125-9.625 2-10 7-10s8.125.375 7 10"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 21h14"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 21s1-6 2-6 5 6 5 6 4-6 5-6 2 6 2 6"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 11C8 2 16 2 12 11z"/>';
        } else if (cat.includes('cookie')) {
            // Cookie Icon (Circle with dots)
            iconPath = '<circle cx="12" cy="12" r="10" stroke-width="1.5"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 9.5h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.5 11.5h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.5 15.5h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 8h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12h.01"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 7h.01"/>';
        } else {
            // Default "Bag" Icon
            iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />';
        }

        const card = document.createElement('div');
        card.className = `kanban-card status-${status}`;
        card.draggable = true;
        card.dataset.id = req.id;

        card.innerHTML = `
            <div class="card-header">
                <span class="card-date">${date}</span>
                <div class="card-icon" title="${req.step1_data?.category || 'Order'}">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity:0.6;">
                        ${iconPath}
                    </svg>
                </div>
            </div>
            <strong class="card-title">${custName}</strong>
            
            <div class="card-body-compact">
                <div class="card-row">
                    <span>${req.step1_data?.category || 'General'}</span>
                    ${req.step1_data?.quantity_value ? `<span>· ${req.step1_data.quantity_value}</span>` : ''}
                </div>
                 ${req.step1_data?.event_date ? `<div class="card-row text-xs">${req.step1_data.event_date}</div>` : ''}
            </div>

            ${req.step1_data?.rush_flag ? '<span class="card-tag tag-rush">URGENT</span>' : ''}
        `;

        // Drag listeners for Card
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        // Click listener for Card (Open Modal)
        card.addEventListener('click', () => {
            openModal(req.id);
        });

        // Add staggered animation delay
        // We can just rely on built-in animation, but for true stagger on load we need index.
        // Since we are iterating all requests, we aren't iterating per column easily with index.
        // Let's just set a random small delay or depend on natural render.
        // Or better: set a style that depends on something unique if possible, but random is fun for "organic" feel.
        card.style.animationDelay = `${Math.random() * 0.3}s`;

        els.boardColumns[status].appendChild(card);
    });

    // Update Counts in Headers
    document.querySelectorAll('.board-column').forEach(col => {
        const countSpan = col.querySelector('.column-count');
        const contentDiv = col.querySelector('.column-content');
        if (countSpan && contentDiv) {
            countSpan.textContent = contentDiv.children.length;
        }
    });
}

// --- DRAG AND DROP LOGIC ---

let draggedItem = null;

function initDragAndDrop() {
    const columns = document.querySelectorAll('.board-column');

    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault(); // Allow drop
            column.style.background = '#e5e7eb'; // Highlight
        });

        column.addEventListener('dragleave', e => {
            column.style.background = '#f3f4f6'; // Reset
        });

        column.addEventListener('drop', async e => {
            e.preventDefault();
            column.style.background = '#f3f4f6';

            if (!draggedItem) return;

            const newStatus = column.dataset.status;
            const requestId = draggedItem.dataset.id;

            // Optimistic UI Update handled by renderBoard when snapshot fires, 
            // but we can move it visually just to be snappy if we want.
            // For now, let's rely on Firestore real-time update.

            try {
                const reqRef = doc(db, "requests", requestId);
                await updateDoc(reqRef, {
                    status: newStatus,
                    updated_at: new Date()
                });
                console.log(`Updated request ${requestId} to ${newStatus}`);
            } catch (error) {
                console.error("Error updating status:", error);
                alert("Failed to update status.");
            }
        });
    });
}

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;
}


// --- MODAL & DETAIL VIEW ---

// State for Modal Editing
let isEditMode = false;
let currentModalRequestId = null;

function openModal(requestId) {
    currentModalRequestId = requestId;
    isEditMode = false; // Reset to view mode
    renderModal();
    els.modal.classList.remove('hidden');
}

function renderModal() {
    const req = requests.find(r => r.id === currentModalRequestId);
    if (!req) return;
    const cust = customers[req.customer_id] || {};

    els.modalBody.innerHTML = renderModalBody(req, cust, isEditMode);

    updateModalFooter(req);
}

function renderModalBody(req, cust, isEditing) {
    const s1 = req.step1_data || {};
    const s2 = req.step2_data || {};

    // Images Helper
    let imagesHtml = '';
    const imgs = s2.inspiration_images || [];
    if (imgs.length > 0) {
        imagesHtml = `<div class="gallery-grid">`;
        imgs.forEach(url => {
            imagesHtml += `<a href="${url}" target="_blank"><img src="${url}" class="gallery-img"></a>`;
        });
        imagesHtml += `</div>`;
    } else {
        imagesHtml = `<p class="text-muted">No images uploaded.</p>`;
    }

    if (!isEditing) {
        // --- READ ONLY VIEW ---
        return `
        <div class="modal-hero">
            <div class="hero-left">
                <span class="hero-id">#${req.id}</span>
                <span class="hero-status status-${req.status}">${req.status}</span>
            </div>
            <div class="hero-right">
                <span class="hero-date">${req.created_at ? new Date(req.created_at.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
            </div>
        </div>

        <div class="modal-grid">
            <!-- Customer Card -->
            <div class="modal-card">
                <div class="modal-card-header">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    CUSTOMER
                </div>
                <div class="modal-card-body">
                    <div class="info-group">
                        <label>Name</label>
                        <div class="info-value text-lg">${cust.name || 'Unknown'}</div>
                    </div>
                    <div class="info-group">
                        <label>Email</label>
                        <div class="info-value"><a href="mailto:${cust.email}">${cust.email || '-'}</a></div>
                    </div>
                    <div class="info-group">
                        <label>Phone</label>
                        <div class="info-value">${cust.phone || '-'}</div>
                    </div>
                    ${s2.hear_about_us ? `
                    <div class="info-group" style="margin-top:0.5rem; border-top:1px dashed #eee; padding-top:0.5rem;">
                        <label>Source</label>
                        <div class="info-value text-sm text-gray-600">${s2.hear_about_us}</div>
                    </div>` : ''}
                </div>
            </div>

            <!-- Event Card -->
            <div class="modal-card">
                <div class="modal-card-header">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    EVENT SPECS
                </div>
                <div class="modal-card-body">
                    <div class="info-group">
                        <label>Date & Type</label>
                        <div class="info-value text-lg">${s1.event_date || 'TBD'} <span class="text-muted">·</span> ${s1.category || 'General'}</div>
                    </div>
                    <div class="info-group">
                        <label>Quantity</label>
                        <div class="info-value">${s1.quantity_value || '-'}</div>
                    </div>
                    ${s2.add_ons && s2.add_ons.length > 0 ? `
                    <div class="info-group" style="padding-top:0.5rem; margin-top:0.5rem; border-top:1px dashed #eee;">
                         <label>➕ Add-ons</label>
                         <div class="info-value">
                            ${s2.add_ons.map(a => `<div>• <strong>${a.type}</strong>: ${a.qty}</div>`).join('')}
                         </div>
                    </div>` : ''}
                    ${s2.allergies === 'yes' ? `
                    <div class="info-group">
                         <label style="color:#dc2626; font-weight:bold;">⚠️ ALLERGIES</label>
                         <div class="info-value" style="color:#dc2626; font-weight:bold;">${s2.allergy_details || 'Yes'}</div>
                    </div>` : ''}
                    <div class="info-group">
                        <label>Fulfillment</label>
                        <div class="info-value">${s1.fulfillment || '-'} ${s1.delivery_zip ? '(' + s1.delivery_zip + ')' : ''}</div>
                    </div>
                    ${s1.rush_flag ? '<div class="rush-badge">⚠️ RUSH ORDER</div>' : ''}
                    
                    ${req.quote_pdf_url ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
                        <label>Quote Status</label>
                        <div style="display:flex; flex-direction:column; gap:0.25rem;">
                            <a href="${req.quote_pdf_url}" target="_blank" class="text-blue-600 hover:underline" style="display:flex; align-items:center; gap:0.25rem;">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                View PDF
                            </a>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                ${req.quote_last_sent ? `<div class="text-xs text-gray-500">Sent: ${new Date(req.quote_last_sent.seconds * 1000).toLocaleDateString()}</div>` : '<div class="text-xs text-orange-500">Not sent yet</div>'}
                                <button onclick="els.modal.classList.add('hidden'); openQuoteModal('${req.id}')" class="text-xs text-blue-600 hover:underline border border-blue-200 rounded px-2 py-0.5 bg-blue-50">Resend</button>
                            </div>
                            ${req.quote_total ? `<div class="text-xs font-semibold">Total: $${parseFloat(req.quote_total).toFixed(2)}</div>` : ''}
                        </div>
                    </div>` : ''}
                </div>
            </div>

            <!-- Design Details (Full Width) -->
            <div class="modal-card full-width">
                <div class="modal-card-header">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    DESIGN & INSPO
                </div>
                <div class="modal-card-body" style="display: flex; gap: 1.5rem;">
                    <!-- Left: Specs & Notes -->
                    <div style="flex: 3;">
                        <div class="design-grid" style="margin-bottom: 1rem;">
                            <div class="info-group">
                                <label>Theme</label>
                                <div class="info-value">${s2.theme_keywords || '-'}</div>
                            </div>
                            <div class="info-group">
                                <label>Colors</label>
                                <div class="info-value">${s2.colors || '-'}</div>
                            </div>
                            <div class="info-group">
                                <label>Occasion</label>
                                <div class="info-value">${s2.occasion || '-'}</div>
                            </div>
                            <div class="info-group">
                                <label>Budget</label>
                                <div class="info-value">${s2.budget_range || '-'}</div>
                            </div>
                            <div class="info-group">
                                <label>Complexity</label>
                                <div class="info-value">${s2.complexity || '-'}</div>
                            </div>
                        </div>
                        <div class="info-group">
                            <label>Notes</label>
                            <div class="notes-box" style="max-height: 80px; overflow-y: auto;">${s2.notes || 'No notes provided.'}</div>
                        </div>
                    </div>
                    
                    <!-- Right: Photos -->
                    <div style="flex: 2; border-left: 1px solid rgba(0,0,0,0.05); padding-left: 1.5rem; display: flex; flex-direction: column;">
                        <label>Inspiration Photos</label>
                        <div style="flex: 1; min-height: 0;">
                            ${imagesHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    } else {
        // --- EDIT VIEW ---

        // Parse Add-ons for Edit Form
        const addons = s2.add_ons || [];
        const cookies = addons.find(a => a.type === 'Cookies');
        const cupcakes = addons.find(a => a.type === 'Cupcakes');
        const cake = addons.find(a => a.type === 'Cake');

        return `
        <div class="modal-hero">
            <div class="hero-left">
                <span class="hero-id">#${req.id}</span>
                <span class="hero-status status-${req.status}">${req.status}</span>
            </div>
            <div class="hero-right">
                <span class="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">EDITING MODE</span>
            </div>
        </div>

        <form id="edit-request-form" class="modal-grid">
            <!-- Customer (Linked Read Only) -->
            <div class="modal-card">
                 <div class="modal-card-header">CUSTOMER</div>
                 <div class="modal-card-body">
                      <p><strong>${cust.name || 'Unknown'}</strong></p>
                      <p class="text-sm text-gray-500">Edit customer details via Customers tab.</p>
                 </div>
            </div>

            <!-- Event Specs Edit -->
            <div class="modal-card">
                 <div class="modal-card-header">EVENT SPECS</div>
                 <div class="modal-card-body" style="gap: 1rem; display: flex; flex-direction: column;">
                      
                      <div class="form-group">
                         <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Category</label>
                         <select name="category" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                             <option value="Custom Cake" ${s1.category === 'Custom Cake' ? 'selected' : ''}>Custom Cake</option>
                             <option value="Cupcakes" ${s1.category === 'Cupcakes' ? 'selected' : ''}>Cupcakes</option>
                             <option value="Cookies" ${s1.category === 'Cookies' ? 'selected' : ''}>Cookies</option>
                             <option value="Other" ${(s1.category !== 'Custom Cake' && s1.category !== 'Cupcakes' && s1.category !== 'Cookies') ? 'selected' : ''}>Other</option>
                         </select>
                      </div>

                      <div class="form-group">
                         <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Event Date</label>
                         <input type="date" name="event_date" value="${s1.event_date || ''}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                      </div>

                      <div class="form-group">
                         <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Quantity / Size</label>
                         <input type="text" name="quantity_value" value="${s1.quantity_value || ''}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                      </div>
                      
                      <!-- Add-ons Edit -->
                      <div class="form-group" style="padding-top:0.5rem; margin-top:0.5rem; border-top:1px dashed #eee;">
                         <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:8px;">➕ Add-ons</label>
                         
                         <div style="display:grid; grid-template-columns: 24px 100px 1fr; gap: 8px; align-items:center; margin-bottom:8px;">
                             <input type="checkbox" name="ao_cookies_check" ${cookies ? 'checked' : ''} style="width:18px; height:18px;">
                             <label style="margin:0;">Cookies</label>
                             <input type="text" name="ao_cookies_qty" value="${cookies ? cookies.qty : ''}" placeholder="Qty (Dozens)" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                         </div>

                         <div style="display:grid; grid-template-columns: 24px 100px 1fr; gap: 8px; align-items:center; margin-bottom:8px;">
                             <input type="checkbox" name="ao_cupcakes_check" ${cupcakes ? 'checked' : ''} style="width:18px; height:18px;">
                             <label style="margin:0;">Cupcakes</label>
                             <input type="text" name="ao_cupcakes_qty" value="${cupcakes ? cupcakes.qty : ''}" placeholder="Qty (Dozens)" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                         </div>

                         <div style="display:grid; grid-template-columns: 24px 100px 1fr; gap: 8px; align-items:center;">
                             <input type="checkbox" name="ao_cake_check" ${cake ? 'checked' : ''} style="width:18px; height:18px;">
                             <label style="margin:0;">Cake</label>
                             <input type="text" name="ao_cake_qty" value="${cake ? cake.qty : ''}" placeholder="Size/Details" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                         </div>
                      </div>

                      <div class="form-group">
                         <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Fulfillment</label>
                         <div style="display:flex; gap:0.5rem;">
                            <select name="fulfillment" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                                <option value="Pickup" ${s1.fulfillment === 'Pickup' ? 'selected' : ''}>Pickup</option>
                                <option value="Delivery" ${s1.fulfillment === 'Delivery' ? 'selected' : ''}>Delivery</option>
                            </select>
                            <input type="text" name="delivery_zip" value="${s1.delivery_zip || ''}" placeholder="Zip Code" style="width:80px; padding:6px; border:1px solid #ccc; border-radius:4px;">
                         </div>
                      </div>

                      <div style="margin-top:0.5rem;">
                         <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" name="rush_flag" ${s1.rush_flag ? 'checked' : ''}>
                            <span style="font-size:0.9rem; margin-left:6px; font-weight:600; color:#dc2626;">Rush Order</span>
                         </label>
                      </div>
                 </div>
            </div>

            <!-- Design Edit -->
            <div class="modal-card full-width">
                 <div class="modal-card-header">DESIGN DETAILS</div>
                 <div class="modal-card-body">
                      
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom:1rem;">
                           <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Theme / Keywords</label>
                               <input type="text" name="theme_keywords" value="${s2.theme_keywords || ''}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                           </div>
                            <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Colors</label>
                               <input type="text" name="colors" value="${s2.colors || ''}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                           </div>
                            <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Occasion</label>
                               <select name="occasion" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                                    <option value="">Select...</option>
                                    <option value="birthday" ${s2.occasion === 'birthday' ? 'selected' : ''}>Birthday</option>
                                    <option value="shower" ${s2.occasion === 'shower' ? 'selected' : ''}>Baby/Bridal Shower</option>
                                    <option value="wedding" ${s2.occasion === 'wedding' ? 'selected' : ''}>Wedding</option>
                                    <option value="corporate" ${s2.occasion === 'corporate' ? 'selected' : ''}>Corporate</option>
                                    <option value="other" ${s2.occasion === 'other' ? 'selected' : ''}>Other</option>
                               </select>
                           </div>
                            <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Budget Range</label>
                               <select name="budget_range" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                                    <option value="">Unsure / Flexible</option>
                                    <option value="under75" ${s2.budget_range === 'under75' ? 'selected' : ''}>Under $75</option>
                                    <option value="75-150" ${s2.budget_range === '75-150' ? 'selected' : ''}>$75 - $150</option>
                                    <option value="150-300" ${s2.budget_range === '150-300' ? 'selected' : ''}>$150 - $300</option>
                                    <option value="300+" ${s2.budget_range === '300+' ? 'selected' : ''}>$300+</option>
                               </select>
                           </div>
                           <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Complexity</label>
                               <select name="complexity" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                                    <option value="">No preference</option>
                                    <option value="simple" ${s2.complexity === 'simple' ? 'selected' : ''}>Simple</option>
                                    <option value="standard" ${s2.complexity === 'standard' ? 'selected' : ''}>Standard</option>
                                    <option value="detailed" ${s2.complexity === 'detailed' ? 'selected' : ''}>Detailed</option>
                               </select>
                           </div>

                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom:1rem;">
                            <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Source</label>
                               <select name="hear_about_us" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                                    <option value="">Select...</option>
                                    <option value="Google Search" ${s2.hear_about_us?.includes('Google') ? 'selected' : ''}>Google Search</option>
                                    <option value="Social Media (Instagram/Facebook)" ${s2.hear_about_us?.includes('Social') ? 'selected' : ''}>Social Media</option>
                                    <option value="Friend/Family Referral" ${s2.hear_about_us?.includes('Referral') ? 'selected' : ''}>Friend/Family Referral</option>
                                    <option value="Returning Customer" ${s2.hear_about_us?.includes('Returning') ? 'selected' : ''}>Returning Customer</option>
                                    <option value="Other" ${s2.hear_about_us?.includes('Other') ? 'selected' : ''}>Other</option>
                               </select>
                           </div>
                           <div class="form-group">
                               <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px; color:#dc2626;">Allergies (Details)</label>
                               <input type="text" name="allergy_details" value="${s2.allergy_details || ''}" placeholder="Leave empty if None" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
                           </div>
                      </div>

                      <div class="form-group">
                           <label style="display:block; font-size:0.85rem; font-weight:500; margin-bottom:4px;">Notes</label>
                           <textarea name="notes" rows="3" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">${s2.notes || ''}</textarea>
                      </div>
                      
                      <div class="form-group" style="margin-top:1rem; padding-top:1rem; border-top:1px solid #eee;">
                         <label class="text-sm font-medium">📷 Add New Inspiration Images</label>
                         <input type="file" id="edit-req-upload" multiple accept="image/*" style="margin-top:4px;">
                         <p class="text-xs text-muted" style="margin-top:4px;">These will be added to the existing images.</p>
                      </div>
                      
                      <div style="margin-top:1rem;">
                         <label class="text-sm font-medium">Existing Images</label>
                         <div class="gallery-grid" style="margin-top:0.5rem;">
                            ${(s2.inspiration_images || []).map((url, idx) => `
                                <div style="position:relative; display:inline-block;">
                                    <img src="${url}" class="gallery-img" style="max-height:100px; width:auto; border-radius:4px; border:1px solid #ddd;">
                                    <button type="button" class="btn-delete-img" data-idx="${idx}" style="position:absolute; top:-8px; right:-8px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
                                </div>
                            `).join('')}
                            ${(!s2.inspiration_images || s2.inspiration_images.length === 0) ? '<p class="text-muted text-sm">No images.</p>' : ''}
                         </div>
                         <input type="hidden" name="deleted_images_indices" id="deleted-images-indices" value="">
                      </div>
                 </div>
            </div>
        </form>
        `;
    }
}

// Helper to handle image deletion in UI
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-img')) {
        if (!confirm("Are you sure you want to delete this image? This cannot be undone once saved.")) {
            return;
        }
        const idx = e.target.getAttribute('data-idx');
        const hiddenInput = document.getElementById('deleted-images-indices');
        if (hiddenInput) {
            const currentDeleted = hiddenInput.value ? hiddenInput.value.split(',') : [];
            currentDeleted.push(idx);
            hiddenInput.value = currentDeleted.join(',');
            // Visually hide
            e.target.parentElement.style.display = 'none';
        }
    }
});

function updateModalFooter(req) { // No changes needed
    const footer = els.modal.querySelector('.modal-footer');
    if (!footer) return;

    footer.innerHTML = ''; // Rebuild

    // Left Side: Delete or Cancel
    const leftDiv = document.createElement('div');
    leftDiv.style.marginRight = 'auto'; // push others to right
    footer.appendChild(leftDiv);

    if (isEditMode) {
        // CANCEL Button
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn-text';
        btnCancel.textContent = 'Cancel Edit';
        btnCancel.onclick = () => {
            isEditMode = false;
            renderModal();
        };
        leftDiv.appendChild(btnCancel);

    } else {
        // DELETE Button (Existing logic)
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-sm btn-delete-request';
        delBtn.style.color = '#dc2626'; // Text color instead of heavy background
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.textContent = 'Delete Request';
        delBtn.type = 'button';
        delBtn.onclick = async (e) => {
            if (e) e.preventDefault();
            if (confirm('Are you sure you want to PERMANENTLY delete this request? This cannot be undone.')) {
                try {
                    // 1. Delete associated images from Storage
                    const images = req.step2_data?.inspiration_images || [];
                    if (images.length > 0) {
                        console.log(`Deleting ${images.length} images for request ${req.id}...`);
                        const deletePromises = images.map(url => {
                            try {
                                const fileRef = ref(storage, url);
                                return deleteObject(fileRef).catch(err => {
                                    console.warn(`Failed to delete image ${url}:`, err);
                                });
                            } catch (err) {
                                console.warn(`Invalid URL for deletion ${url}:`, err);
                                return Promise.resolve();
                            }
                        });
                        await Promise.all(deletePromises);
                    }

                    // 2. Delete Firestore Document
                    await deleteDoc(doc(db, "requests", req.id));
                    els.modal.classList.add('hidden');
                    alert("Request and associated images deleted successfully.");
                } catch (err) {
                    console.error("Error deleting:", err);
                    alert("Failed to delete request. See console for details.");
                }
            }
        };
        leftDiv.appendChild(delBtn);
    }

    // Right Side: Actions
    const rightDiv = document.createElement('div');
    rightDiv.style.display = 'flex';
    rightDiv.style.gap = '8px';
    footer.appendChild(rightDiv);

    if (isEditMode) {
        // SAVE Button
        const btnSave = document.createElement('button');
        btnSave.className = 'btn-primary';
        btnSave.textContent = 'Save Changes';
        btnSave.onclick = saveRequestDetails;
        rightDiv.appendChild(btnSave);

    } else {
        // VIEW MODE Buttons
        // 1. Edit Details Button
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-secondary';
        btnEdit.textContent = 'Edit Details';
        btnEdit.onclick = () => {
            isEditMode = true;
            renderModal();
        };
        rightDiv.appendChild(btnEdit);

        // 2. Record Deposit (Conditional)
        if (['AWAITING_DETAILS', 'QUOTING'].includes(req.status)) {
            const btnDeposit = document.createElement('button');
            btnDeposit.className = 'btn-secondary';
            btnDeposit.innerText = 'Record Deposit';
            btnDeposit.onclick = () => openDepositModal(req);
            rightDiv.appendChild(btnDeposit);
        }

        // 3. Create Quote
        const btnQuote = document.createElement('button');
        btnQuote.className = 'btn-primary';
        btnQuote.innerText = 'Create Quote';
        btnQuote.onclick = () => {
            els.modal.classList.add('hidden');
            openQuoteModal(req.id);
        };
        rightDiv.appendChild(btnQuote);
    }
}

async function saveRequestDetails() {
    if (!currentModalRequestId) return;
    const form = document.getElementById('edit-request-form');
    if (!form) return;

    const btn = els.modal.querySelector('.btn-primary'); // Save button
    const oldText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        // Gather data
        const formData = new FormData(form);

        // Image Upload Logic
        const fileInput = document.getElementById('edit-req-upload');
        let newImageUrls = [];

        if (fileInput && fileInput.files.length > 0) {
            btn.textContent = 'Uploading...';
            // Need requestId for path
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const filePath = `requests/${currentModalRequestId}/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, filePath);
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                newImageUrls.push(downloadURL);
            }
        }

        // Get existing images from local request state
        const currentReq = requests.find(r => r.id === currentModalRequestId);
        let existingImages = currentReq?.step2_data?.inspiration_images || [];

        // Filter out deleted images
        const deletedIndicesInput = document.getElementById('deleted-images-indices');
        if (deletedIndicesInput && deletedIndicesInput.value) {
            const indicesToDelete = deletedIndicesInput.value.split(',').map(Number);

            // PERMANENT STORAGE DELETION
            const imagesToDelete = existingImages.filter((_, index) => indicesToDelete.includes(index));
            for (const imageUrl of imagesToDelete) {
                try {
                    // Create a reference from the HTTPS URL
                    // Note: ref(storage, url) works with HTTPS URLs in simpler SDK versions,
                    // but sometimes requires parsing. Let's try direct ref from URL.
                    const fileRef = ref(storage, imageUrl);
                    await deleteObject(fileRef);
                    console.log("Deleted from storage:", imageUrl);
                } catch (err) {
                    console.warn("Could not delete image from storage (might stay orphaned):", imageUrl, err);
                }
            }

            existingImages = existingImages.filter((_, index) => !indicesToDelete.includes(index));
        }

        const finalImages = [...existingImages, ...newImageUrls];

        // Add-ons Logic
        const addOns = [];
        if (formData.get('ao_cookies_check')) {
            addOns.push({ type: 'Cookies', qty: formData.get('ao_cookies_qty') || '2 dozen' });
        }
        if (formData.get('ao_cupcakes_check')) {
            addOns.push({ type: 'Cupcakes', qty: formData.get('ao_cupcakes_qty') || '2 dozen' });
        }
        if (formData.get('ao_cake_check')) {
            addOns.push({ type: 'Cake', qty: formData.get('ao_cake_qty') || 'See notes' });
        }

        const updates = {
            'step1_data.category': formData.get('category'),
            'step1_data.event_date': formData.get('event_date'),
            'step1_data.quantity_value': formData.get('quantity_value'),
            'step1_data.fulfillment': formData.get('fulfillment'),
            'step1_data.delivery_zip': formData.get('delivery_zip'),
            'step1_data.rush_flag': formData.get('rush_flag') === 'on',

            'step2_data.theme_keywords': formData.get('theme_keywords'),
            'step2_data.colors': formData.get('colors'),
            'step2_data.occasion': formData.get('occasion'),
            'step2_data.budget_range': formData.get('budget_range'),
            'step2_data.complexity': formData.get('complexity'),

            'step2_data.hear_about_us': formData.get('hear_about_us'),
            'step2_data.allergy_details': formData.get('allergy_details'),
            'step2_data.allergies': formData.get('allergy_details') ? 'yes' : 'no', // Derive yes/no
            'step2_data.notes': formData.get('notes'),

            'step2_data.add_ons': addOns,
            'step2_data.inspiration_images': finalImages,

            updated_at: new Date()
        };

        btn.textContent = 'Saving Doc...';
        await updateDoc(doc(db, "requests", currentModalRequestId), updates);

        // Success
        isEditMode = false;

        // Manually update local 'requests' object for immediate feedback
        const reqIndex = requests.findIndex(r => r.id === currentModalRequestId);
        if (reqIndex !== -1) {
            const req = requests[reqIndex];
            if (!req.step1_data) req.step1_data = {};
            if (!req.step2_data) req.step2_data = {};

            // Apply updates to local object (flattens dot notation)
            req.step1_data.category = updates['step1_data.category'];
            req.step1_data.event_date = updates['step1_data.event_date'];
            req.step1_data.quantity_value = updates['step1_data.quantity_value'];
            req.step1_data.fulfillment = updates['step1_data.fulfillment'];
            req.step1_data.delivery_zip = updates['step1_data.delivery_zip'];
            req.step1_data.rush_flag = updates['step1_data.rush_flag'];

            req.step2_data.theme_keywords = updates['step2_data.theme_keywords'];
            req.step2_data.colors = updates['step2_data.colors'];
            req.step2_data.occasion = updates['step2_data.occasion'];
            req.step2_data.budget_range = updates['step2_data.budget_range'];
            req.step2_data.complexity = updates['step2_data.complexity']; // Added
            req.step2_data.notes = updates['step2_data.notes'];
            req.step2_data.add_ons = updates['step2_data.add_ons']; // Added
            req.step2_data.inspiration_images = updates['step2_data.inspiration_images']; // Added
            req.step2_data.hear_about_us = updates['step2_data.hear_about_us']; // Added missing

            // Allergies
            req.step2_data.allergy_details = updates['step2_data.allergy_details'];
            req.step2_data.allergies = updates['step2_data.allergies'];
        }

        renderModal(); // Re-render with (optimistically) updated data

    } catch (e) {
        console.error("Error updating request:", e);
        alert("Failed to save changes: " + e.message);
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

els.closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        els.modal.classList.add('hidden');
        els.quoteModal.classList.add('hidden');
        if (els.customerModal) els.customerModal.classList.add('hidden');
        if (els.newReqModal) els.newReqModal.classList.add('hidden'); // Fix 1: Close new modal
    });
});

// Utils
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// --- QUOTE ENGINE LOGIC ---

function initQuoteLogic() {
    if (els.btnAddItem) els.btnAddItem.addEventListener('click', addQuoteItem);

    if (els.quoteDelivery) els.quoteDelivery.addEventListener('input', updateQuoteTotals);
    if (els.quoteRush) els.quoteRush.addEventListener('input', updateQuoteTotals);

    if (els.btnGeneratePdf) els.btnGeneratePdf.addEventListener('click', generatePDF);
    if (els.btnSendEmail) els.btnSendEmail.addEventListener('click', sendEmail);
}

function openQuoteModal(requestId) {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    currentQuoteRequest = req;
    currentQuoteItems = [];

    // Reset UI
    els.quoteCustName.textContent = customers[req.customer_id]?.name || 'Unknown';
    els.quoteReqId.textContent = '#' + req.id.slice(0, 6);
    els.quoteItemsBody.innerHTML = '';
    els.quoteDelivery.value = 0;
    els.quoteRush.value = 0;
    els.quoteResult.classList.add('hidden');
    els.btnSendEmail.disabled = true;
    els.btnSendEmail.style.opacity = '0.5';

    // Check if Quote already exists
    if (req.quote_pdf_url) {
        els.quotePdfLink.href = req.quote_pdf_url;
        els.btnSendEmail.dataset.pdfUrl = req.quote_pdf_url;
        els.quoteResult.classList.remove('hidden');
        els.btnSendEmail.disabled = false;
        els.btnSendEmail.style.opacity = '1';
        els.btnGeneratePdf.textContent = 'Regenerate PDF';
    } else {
        els.btnGeneratePdf.textContent = 'Generate Quote PDF';
    }

    if (document.getElementById('quote-email-message')) {
        const custName = customers[req.customer_id]?.name || 'Valued Customer';
        const dueDate = req.step1_data?.event_date ? new Date(req.step1_data.event_date).toLocaleDateString() : 'TBD';

        document.getElementById('quote-email-message').value = `Hi ${custName},

Thank you for your patience as I put together an estimate for you. Attached is a PDF of your order request, which is valid for 14 days. After this period, prices may be subject to change based on ingredient costs and availability.

Look over the estimate and let me know if there’s anything you’d like to change. If you’re content with everything, at least 50% is due up front to confirm your order and officially secure a spot on my calendar. The remaining will be due upon pick up on ${dueDate}. 

Thank you for considering me and my small business! I appreciate it more than you’ll ever know.

Kristen
Baked By Bostik`;
    }

    // Add default item from request
    if (req.step1_data) {
        currentQuoteItems.push({
            name: `${req.step1_data.category} (${req.step1_data.quantity_value}) - ${req.step1_data.fulfillment}`,
            qty: 1,
            price: 0
        });
    }

    renderQuoteItems();
    els.quoteModal.classList.remove('hidden');
}

function addQuoteItem() {
    currentQuoteItems.push({ name: '', qty: 1, price: 0 });
    renderQuoteItems();
}

function renderQuoteItems() {
    els.quoteItemsBody.innerHTML = '';

    currentQuoteItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:0.5rem;"><input type="text" class="q-name" value="${item.name}" placeholder="Item Description" style="width:100%; padding:0.5rem; border:1px solid #e5e7eb; border-radius:4px;"></td>
            <td style="padding:0.5rem;"><input type="number" class="q-qty" value="${item.qty}" min="1" style="width:100%; padding:0.5rem; border:1px solid #e5e7eb; border-radius:4px;"></td>
            <td style="padding:0.5rem;"><input type="number" class="q-price" value="${item.price}" min="0" step="0.01" style="width:100%; padding:0.5rem; border:1px solid #e5e7eb; border-radius:4px;"></td>
            <td style="padding:0.5rem; text-align:right;" class="q-row-total">$${(item.qty * item.price).toFixed(2)}</td>
            <td style="padding:0.5rem; text-align:center;"><button class="btn-text" style="color:red;">&times;</button></td>
        `;

        // Listeners for inputs
        const inputs = tr.querySelectorAll('input');
        const totalCell = tr.querySelector('.q-row-total');

        // Name
        inputs[0].addEventListener('input', (e) => { item.name = e.target.value; });

        // Qty
        inputs[1].addEventListener('input', (e) => {
            item.qty = Number(e.target.value);
            totalCell.textContent = '$' + (item.qty * item.price).toFixed(2);
            updateQuoteTotals();
        });

        // Price
        inputs[2].addEventListener('input', (e) => {
            item.price = Number(e.target.value);
            totalCell.textContent = '$' + (item.qty * item.price).toFixed(2);
            updateQuoteTotals();
        });

        // Delete
        tr.querySelector('button').addEventListener('click', () => {
            currentQuoteItems.splice(index, 1);
            renderQuoteItems(); // Re-render needed for delete
        });

        els.quoteItemsBody.appendChild(tr);
    });

    updateQuoteTotals();
}

function updateQuoteTotals() {
    const subtotal = currentQuoteItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const delivery = Number(els.quoteDelivery.value) || 0;
    const rush = Number(els.quoteRush.value) || 0;
    const total = subtotal + delivery + rush;

    els.quoteSubtotal.textContent = '$' + subtotal.toFixed(2);
    els.quoteTotal.textContent = '$' + total.toFixed(2);

    return { subtotal, delivery, rush, total };
}

async function generatePDF() {
    const btn = els.btnGeneratePdf;
    const originalText = btn.textContent;
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        const totals = updateQuoteTotals();
        const customerName = customers[currentQuoteRequest.customer_id]?.name || 'Valued Customer';

        const projectId = firebaseConfig.authDomain ? firebaseConfig.authDomain.split('.')[0] : 'baked-by-bostik';
        const fnUrl = `https://us-central1-${projectId}.cloudfunctions.net/createQuotePDF`; // Updated to V2

        const quoteNotes = document.getElementById('quote-notes').value;

        const res = await fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestId: currentQuoteRequest.id,
                customerName: customerName,
                items: currentQuoteItems,
                totals: totals,
                notes: quoteNotes // Added
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error("Server Error: " + txt);
        }

        const data = await res.json();

        let pdfDownloadUrl = '';
        let pdfStoragePath = '';

        // Success: Handle both URL (legacy) and storagePath (new)
        if (data.storagePath) {
            pdfStoragePath = data.storagePath;
            const fileRef = ref(storage, data.storagePath);
            pdfDownloadUrl = await getDownloadURL(fileRef);
            els.quotePdfLink.href = pdfDownloadUrl;
        } else if (data.url) {
            pdfDownloadUrl = data.url;
            // If only URL is returned, we don't have a storagePath to save.
        } else {
            throw new Error("No URL or storagePath returned from server");
        }

        els.quotePdfLink.href = pdfDownloadUrl;
        els.btnSendEmail.dataset.pdfUrl = pdfDownloadUrl;

        // Persist Quote Data
        const reqRef = doc(db, "requests", currentQuoteRequest.id);

        // Calculate Quote Total for Persistence
        const quoteTotalValue = totals.total;

        const updateData = {
            quote_total: quoteTotalValue,
            quote_generated_at: new Date()
        };
        if (pdfDownloadUrl) {
            updateData.quote_pdf_url = pdfDownloadUrl;
            // We historically saved storagePath, but it breaks links. 
            // Always prefer full download URL.
        }
        await updateDoc(reqRef, updateData);

        // Update local object immediately for UI responsiveness
        currentQuoteRequest.quote_total = quoteTotalValue;
        currentQuoteRequest.quote_pdf_url = pdfDownloadUrl; // Update with what was saved

        els.quoteResult.classList.remove('hidden');
        els.btnSendEmail.disabled = false;
        els.btnSendEmail.style.opacity = '1';

    } catch (error) {
        console.error("PDF Error:", error);
        alert("Error: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function sendEmail() {
    const btn = els.btnSendEmail;
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        const pdfUrl = btn.dataset.pdfUrl;
        const cust = customers[currentQuoteRequest.customer_id];
        const emailMessage = document.getElementById('quote-email-message').value;

        const projectId = firebaseConfig.authDomain ? firebaseConfig.authDomain.split('.')[0] : 'baked-by-bostik';
        const fnUrl = `https://us-central1-${projectId}.cloudfunctions.net/dispatchQuoteEmail`;

        const res = await fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerEmail: cust.email,
                customerName: cust.name,
                pdfUrl: pdfUrl,
                emailMessage: emailMessage
            })
        });

        if (!res.ok) throw new Error("Failed to send email");

        const data = await res.json();

        if (data.message && data.message.includes("Simulation")) {
            alert("⚠️ SIMULATION MODE\n\nEmail was NOT sent because SMTP credentials are missing in the server configuration.\n\nPlease add SMTP_EMAIL and SMTP_PASSWORD to your Firebase Functions environment variables.");
        } else {
            alert("Email sent successfully!");
            // Move to 'QUOTING' column if not already booked/completed
            // Move to 'QUOTING' column if not already booked/completed
            const updates = {
                quote_last_sent: new Date(),
                status: 'QUOTING'
            };
            // Only update status if meaningful
            if (currentQuoteRequest.status === 'BOOKED' || currentQuoteRequest.status === 'COMPLETED') {
                delete updates.status;
            }

            const reqRef = doc(db, "requests", currentQuoteRequest.id);
            await updateDoc(reqRef, updates);
        }

        els.quoteModal.classList.add('hidden');

    } catch (error) {
        console.error(error);
        alert("Error sending email: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- CUSTOMERS LOGIC ---

function initCustomersLogic() {
    if (els.customerSearch) {
        els.customerSearch.addEventListener('input', (e) => {
            renderCustomersTable(e.target.value);
        });
    }
    if (els.selectAllCheckbox) {
        els.selectAllCheckbox.addEventListener('change', toggleSelectAllCustomers);
    }
    if (els.btnDeleteSelected) {
        els.btnDeleteSelected.addEventListener('click', deleteSelectedCustomers);
    }
    if (els.btnSaveCustomer) {
        els.btnSaveCustomer.addEventListener('click', saveCustomer);
    }
}

async function fetchAllCustomers() {
    try {
        const q = query(collection(db, "customers"), orderBy("name")); // Order by name
        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
            const data = doc.data();
            customers[doc.id] = data; // Update cache
        });

        renderCustomersTable();

    } catch (error) {
        console.error("Error fetching customers:", error);
    }
}

function updateBulkDeleteUI() {
    const count = selectedCustomerIds.size;
    els.selectedCountSpan.textContent = count;
    if (count > 0) {
        els.btnDeleteSelected.classList.remove('hidden');
    } else {
        els.btnDeleteSelected.classList.add('hidden');
    }

    // Update Select All Checkbox state
    const visibleRows = document.querySelectorAll('.customer-checkbox');
    if (visibleRows.length > 0 && visibleRows.length === count) {
        els.selectAllCheckbox.checked = true;
        els.selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
        els.selectAllCheckbox.checked = false;
        els.selectAllCheckbox.indeterminate = true;
    } else {
        els.selectAllCheckbox.checked = false;
        els.selectAllCheckbox.indeterminate = false;
    }
}

function toggleSelectAllCustomers(e) {
    const isChecked = e.target.checked;
    const inputs = document.querySelectorAll('.customer-checkbox');

    inputs.forEach(input => {
        input.checked = isChecked;
        if (isChecked) {
            selectedCustomerIds.add(input.dataset.id);
        } else {
            selectedCustomerIds.delete(input.dataset.id);
        }
    });
    updateBulkDeleteUI();
}

async function deleteSelectedCustomers() {
    const count = selectedCustomerIds.size;
    if (count === 0) return;

    if (confirm(`Are you sure you want to PERMANENTLY delete ${count} customers? This cannot be undone.`)) {
        const btn = els.btnDeleteSelected;
        btn.textContent = 'Deleting...';
        btn.disabled = true;

        try {
            const promises = [];
            selectedCustomerIds.forEach(id => {
                promises.push(deleteDoc(doc(db, "customers", id)));
                delete customers[id]; // Update local cache immediately
            });

            await Promise.all(promises);

            selectedCustomerIds.clear();
            renderCustomersTable(els.customerSearch.value);
            updateBulkDeleteUI();
            alert(`Successfully deleted ${count} customers.`);

        } catch (error) {
            console.error("Bulk delete error:", error);
            alert("Error deleting customers: " + error.message);
        } finally {
            btn.innerHTML = `Delete Selected (<span id="selected-count">0</span>)`;
            btn.disabled = false;
            els.selectedCountSpan = document.getElementById('selected-count'); // Re-bind if lost? No, innerHTML replaced it.
            // Better restore safely
            btn.innerHTML = `Delete Selected (<span id="selected-count">${selectedCustomerIds.size}</span>)`;
            // Re-bind specific element ref if needed, but els.selectedCountSpan holds the old node which is gone.
            els.selectedCountSpan = document.getElementById('selected-count');
            updateBulkDeleteUI();
        }
    }
}

function renderCustomersTable(searchTerm = '') {
    // Note: selectedCustomerIds is global, we keep selections even if filtered out, 
    // unless we want to clear them. For now, let's keep them.

    if (!els.customersTableBody) return;
    els.customersTableBody.innerHTML = '';


    // Convert cache to array
    const all = Object.entries(customers).map(([id, data]) => ({ id, ...data }));

    // Configure Search
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = all.filter(c => {
        return (c.name || '').toLowerCase().includes(lowerTerm) ||
            (c.email || '').toLowerCase().includes(lowerTerm) ||
            (c.phone || '').includes(lowerTerm);
    });

    if (filtered.length === 0) {
        els.customersEmptyState.classList.remove('hidden');
        return;
    }
    els.customersEmptyState.classList.add('hidden');

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        // Handle timestamp or missing date
        let lastOrder = '-';
        if (c.last_updated && c.last_updated.seconds) {
            lastOrder = new Date(c.last_updated.seconds * 1000).toLocaleDateString();
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="customer-checkbox" data-id="${c.id}" ${selectedCustomerIds.has(c.id) ? 'checked' : ''}></td>
            <td><strong>${c.name || 'Unknown'}</strong></td>

            <td><a href="mailto:${c.email}">${c.email || '-'}</a></td>
            <td>${c.phone || '-'}</td>
            <td>${lastOrder}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit-customer" data-id="${c.id}" title="Edit">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="btn-icon btn-view-history" data-id="${c.id}" title="History">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete-customer delete" data-id="${c.id}" title="Delete">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;

        // Checkbox listener
        tr.querySelector('.customer-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCustomerIds.add(c.id);
            } else {
                selectedCustomerIds.delete(c.id);
            }
            updateBulkDeleteUI();
        });

        // Edit Button
        tr.querySelector('.btn-edit-customer').addEventListener('click', () => {
            openCustomerModal(c.id);
        });

        // History button placeholder
        tr.querySelector('.btn-view-history').addEventListener('click', () => {
            alert("Customer History coming soon!");
        });

        // Delete Customer Logic
        tr.querySelector('.btn-delete-customer').addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete customer "${c.name}" (${c.email})?\n\nThis cannot be undone.`)) {
                try {
                    await deleteDoc(doc(db, "customers", c.id));
                    // Also remove from local cache for instant feedback
                    delete customers[c.id];
                    renderCustomersTable(els.customerSearch ? els.customerSearch.value : '');
                } catch (err) {
                    console.error("Error deleting customer:", err);
                    alert("Failed to delete customer: " + err.message);
                }
            }
        });

        els.customersTableBody.appendChild(tr);
    });
}

function openCustomerModal(id) {
    els.editCustId.value = id || '';

    if (id) {
        // Edit Mode
        const cust = customers[id];
        if (!cust) return;
        els.editCustName.value = cust.name || '';
        els.editCustEmail.value = cust.email || '';
        els.editCustPhone.value = cust.phone || '';
        els.customerModal.querySelector('h2').textContent = 'Edit Customer';
    } else {
        // Create Mode
        els.editCustName.value = '';
        els.editCustEmail.value = '';
        els.editCustPhone.value = '';
        els.customerModal.querySelector('h2').textContent = 'New Customer';
        if (els.custHistoryList) els.custHistoryList.innerHTML = '<p class="text-muted">New customer (no history).</p>';
    }

    // Populate History
    if (id && els.custHistoryList) {
        els.custHistoryList.innerHTML = '';
        const customerRequests = requests.filter(r => r.customer_id === id).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

        if (customerRequests.length === 0) {
            els.custHistoryList.innerHTML = '<p class="text-muted">No past orders found.</p>';
        } else {
            customerRequests.forEach(req => {
                const date = req.created_at ? new Date(req.created_at.seconds * 1000).toLocaleDateString() : 'N/A';
                const status = req.status || 'NEW';
                const item = document.createElement('div');
                item.className = 'history-item';
                item.style.padding = '0.5rem';
                item.style.borderBottom = '1px solid #eee';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span><strong>#${req.id.slice(0, 6)}</strong> - ${date}</span>
                        <span class="status-badge status-${status}" style="font-size:0.75rem; padding:2px 6px;">${status}</span>
                    </div>
                    <div style="font-size:0.85rem; color:#666;">
                        ${req.step1_data?.category || 'Order'} · ${req.step1_data?.event_date || 'No Date'}
                    </div>
                 `;
                els.custHistoryList.appendChild(item);
            });
        }
    }

    els.customerModal.classList.remove('hidden');
}

async function saveCustomer(e) {
    if (e) e.preventDefault(); // In case it's a form submit

    const id = els.editCustId.value;
    const name = els.editCustName.value.trim();
    const email = els.editCustEmail.value.trim();
    const phone = els.editCustPhone.value.trim();

    if (!name || !email) {
        alert("Name and Email are required.");
        return;
    }

    const btn = els.btnSaveCustomer;
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        let finalId = id;
        if (id) {
            // Update
            const custRef = doc(db, "customers", id);
            const updates = {
                name: name,
                email: email,
                phone: phone,
                updated_at: new Date()
            };
            await updateDoc(custRef, updates);

            // Local Cache
            if (customers[id]) customers[id] = { ...customers[id], ...updates };
            alert("Customer updated successfully!");
        } else {
            // Create
            const newCust = {
                name: name,
                email: email,
                phone: phone,
                created_at: new Date(),
                updated_at: new Date()
            };
            const docRef = await addDoc(collection(db, "customers"), newCust);
            finalId = docRef.id;

            // Local Cache
            customers[docRef.id] = newCust;
            alert("Customer created successfully!");
        }

        renderCustomersTable(els.customerSearch ? els.customerSearch.value : '');
        els.customerModal.classList.add('hidden');

        // If invoked from Request Modal (inline creation)
        if (els.newReqModal && !els.newReqModal.classList.contains('hidden')) {
            populateCustomerDropdown();
            els.newReqCustomer.value = finalId;
        }

    } catch (error) {
        console.error("Error saving customer:", error);
        alert("Failed to save customer.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- MANUAL ENTRY LOGIC ---

function initNewRequestLogic() {
    // New Request Button
    if (els.btnNewRequest) {
        els.btnNewRequest.addEventListener('click', () => {
            // Populate customer dropdown
            populateCustomerDropdown();
            // Reset form
            if (els.newReqForm) els.newReqForm.reset();
            // Set default date to today or tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('new-req-date').valueAsDate = tomorrow;

            els.newReqModal.classList.remove('hidden');
        });
    }

    // New Customer Button (Customers Page)
    if (els.btnAddCustomer) {
        els.btnAddCustomer.addEventListener('click', () => {
            openCustomerModal(null); // null means create mode
        });
    }

    // Inline Create Customer (New Request Modal)
    if (els.linkCreateCustInline) {
        els.linkCreateCustInline.addEventListener('click', (e) => {
            e.preventDefault();
            els.newReqModal.classList.add('hidden');
            openCustomerModal(null);
            // We could add logic to reopen request modal after save, 
            // but for now, let's keep it simple. User can re-open.
        });
    }

    // New Request Form Submit
    if (els.newReqForm) {
        els.newReqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = els.newReqForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'Creating...';
            btn.disabled = true;

            try {
                const custId = els.newReqCustomer.value;
                const date = document.getElementById('new-req-date').value;
                const cat = document.getElementById('new-req-cat').value;
                const notes = document.getElementById('new-req-notes').value;

                if (!custId) throw new Error("Please select a customer.");

                // Create Request Doc
                const reqData = {
                    customer_id: custId,
                    created_at: new Date(),
                    updated_at: new Date(),
                    status: 'NEW',
                    step1_data: {
                        category: cat,
                        event_date: date, // Format YYYY-MM-DD
                        fulfillment: 'Pickup', // Default to Pickup for manual
                        quantity_value: '1', // Default
                        rush_flag: false
                    },
                    step2_data: {
                        notes: notes,
                        budget_range: 'TBD',
                        theme_keywords: 'Manual Entry'
                    }
                };

                const docRef = await addDoc(collection(db, "requests"), reqData);
                console.log("Created request:", docRef.id);

                els.newReqModal.classList.add('hidden');

                // Open the detail modal for further editing/viewing
                // Need to wait for snapshot to update requests array?
                // Snapshot listener is fast, but we can verify.
                // Or just open it directly if we fetch it?
                // Let's wait a small delay or rely on snapshot.
                // Ideally, we just push to local requests array temporarily or wait.
                // Let's just alert for now or try to open.

                setTimeout(() => {
                    openModal(docRef.id);
                }, 500);

            } catch (error) {
                console.error("Error creating request:", error);
                alert("Error: " + error.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
}

function populateCustomerDropdown() {
    if (!els.newReqCustomer) return;

    els.newReqCustomer.innerHTML = '<option value="">Select a Customer...</option>';

    // Sort customers by name
    const sorted = Object.entries(customers)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.email})`;
        els.newReqCustomer.appendChild(opt);
    });
}

// --- MILESTONE 4: DEPOSIT & ORDERS ---

function openDepositModal(req) {
    if (!els.depositModal) return;

    // Prefill
    els.depositReqId.value = req.id;
    els.depositCustId.value = req.customer_id;

    // Attempt to guess total from Quote items if available
    // (This works if we stored quote items in local state when generating PDF, 
    // but we didn't explicitly persist them in 'req' yet. 
    // We can leave it 0 or try to use currentQuoteItems if the user just viewed the quote modal)
    els.depositTotal.value = '';
    els.depositAmount.value = '';

    els.depositModal.classList.remove('hidden');

    // Auto-fill Total from Quote if available (User Feedback)
    if (req.quote_total) {
        els.depositTotal.value = req.quote_total;
        // Optional: Set deposit to 50%?
        // els.depositAmount.value = (req.quote_total * 0.5).toFixed(2);
    }
}

function initRecordDepositLogic() {
    if (!els.depositForm) return;

    els.depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = els.depositForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            const reqId = els.depositReqId.value;
            const custId = els.depositCustId.value;
            const total = parseFloat(els.depositTotal.value);
            const amount = parseFloat(els.depositAmount.value);
            const note = els.depositNote.value;

            if (!reqId || !custId) throw new Error("Missing request context.");

            // 1. Create Order
            const orderData = {
                customer_id: custId,
                request_id: reqId,
                total_price: total,
                amount_paid: amount, // Track collected cash
                balance_due: total - amount,
                status: 'OPEN',
                created_at: new Date(),
                updated_at: new Date()
            };

            const orderRef = await addDoc(collection(db, "orders"), orderData);
            console.log("Order created:", orderRef.id);

            // 2. Add Payment
            if (amount > 0) {
                const paymentData = {
                    amount: amount,
                    date: new Date(),
                    note: note || 'Initial Deposit',
                    method: 'Manual'
                };
                await addDoc(collection(db, "orders", orderRef.id, "payments"), paymentData);
            }

            // 3. Update Request Status
            const reqRef = doc(db, "requests", reqId);
            await updateDoc(reqRef, {
                status: 'BOOKED',
                updated_at: new Date()
            });

            // UI Cleanup
            alert("Deposit recorded! Request marked as BOOKED.");
            els.depositModal.classList.add('hidden');
            els.modal.classList.add('hidden'); // Close detail modal too

            // Render will update automatically via listeners

        } catch (error) {
            console.error("Error recording deposit:", error);
            alert("Error: " + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}


// --- ANALYTICS LOGIC (Milestone 5) ---

let revenueChartInstance = null;
let productMixChartInstance = null;

function initAnalyticsLogic() {
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) {
        btnExport.addEventListener('click', exportCSV);
    }

    // Set Dynamic Year
    const titleEl = document.getElementById('revenue-chart-title');
    if (titleEl) {
        titleEl.textContent = `Monthly Revenue (${new Date().getFullYear()})`;
    }
}

function updateCharts() {
    const ctxRevenue = document.getElementById('revenueChart');
    if (ctxRevenue) {
        // Aggregate Data
        const revenueByMonth = {};
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();

        monthLabels.forEach(m => revenueByMonth[m] = 0);

        // For Table
        const revenueItems = [];

        orders.forEach(order => {
            let date = null;
            if (order.created_at && order.created_at.seconds) {
                date = new Date(order.created_at.seconds * 1000);
            } else if (order.date) {
                date = new Date(order.date); // Fallback string
            }

            // REVENUE CORRECTION: Only count what is actually paid.
            const collected = parseFloat(order.amount_paid) || 0;
            const total = parseFloat(order.total_price) || 0;
            const outstanding = total - collected;

            if (date && date.getFullYear() === currentYear) {
                const monthName = monthLabels[date.getMonth()];
                revenueByMonth[monthName] += collected;
            }

            // Lookup Linked Request for details
            const linkedReq = requests.find(r => r.id === order.request_id);
            const itemsStr = linkedReq ? (linkedReq.step1_data?.category || "Custom Order") : "Unknown Request";

            // Collect for table
            revenueItems.push({
                dateObj: date || new Date(0), // for sort
                dateStr: date ? date.toLocaleDateString() : 'N/A',
                custName: order.customer_name || (customers[order.customer_id]?.name) || "Unknown",
                items: itemsStr,
                collected: collected,
                outstanding: outstanding,
                reqId: order.request_id // Store for click handler
            });
        });

        const dataValues = monthLabels.map(m => revenueByMonth[m]);

        if (revenueChartInstance) {
            revenueChartInstance.data.datasets[0].data = dataValues;
            revenueChartInstance.update();
        } else {
            revenueChartInstance = new Chart(ctxRevenue, {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Cash Collected ($)',
                        data: dataValues,
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: function (value) { return '$' + value; } }
                        }
                    }
                }
            });
        }

        // Render Revenue Table
        const tableBody = document.getElementById('revenue-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';

            // Hack: Update header if it exists to match new columns
            const tableHeader = document.querySelector('#page-analytics .data-table thead tr');
            if (tableHeader) {
                tableHeader.innerHTML = `
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Collected</th>
                    <th>Outstanding</th>
                `;
            }

            // Sort by Date Descending
            revenueItems.sort((a, b) => b.dateObj - a.dateObj);

            if (revenueItems.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem;">No revenue recorded yet.</td></tr>';
            } else {
                revenueItems.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.cursor = 'pointer';
                    // Inline hover effect for simplicity
                    tr.onmouseover = function () { this.style.backgroundColor = '#f3f4f6'; };
                    tr.onmouseout = function () { this.style.backgroundColor = ''; };

                    // Add Click Handler
                    tr.onclick = function () {
                        if (item.reqId) {
                            openModal(item.reqId);
                        } else {
                            alert("No linked request details found (ID missing on order).");
                        }
                    };

                    const outstandingClass = item.outstanding > 0 ? 'color: #ef4444; font-weight:bold;' : 'color: #d1d5db;';

                    tr.innerHTML = `
                        <td>${item.dateStr}</td>
                        <td><strong>${item.custName}</strong></td>
                        <td>${item.items}</td>
                        <td style="color: #10b981; font-weight:bold;">$${item.collected.toFixed(2)}</td>
                        <td style="${outstandingClass}">$${item.outstanding.toFixed(2)}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            }
        }
    }

    // Check Product Mix Chart as well to ensure it updates if on same page
    const ctxMix = document.getElementById('productMixChart');
    if (ctxMix) {
        const counts = {};

        requests.forEach(req => {
            const cat = req.step1_data?.category || 'Other';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);

        const backgroundColors = [
            '#F472B6', '#60A5FA', '#FBBF24', '#A78BFA', '#34D399', '#9CA3AF'
        ];

        if (productMixChartInstance) {
            productMixChartInstance.data.labels = labels;
            productMixChartInstance.data.datasets[0].data = data;
            productMixChartInstance.update();
        } else {
            productMixChartInstance = new Chart(ctxMix, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

}

function exportCSV() {
    if (!orders || orders.length === 0) {
        alert("No orders available to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Order ID,Customer Name,Customer Email,Items Summary,Amount Paid ($)\n";

    orders.forEach(order => {
        let dateStr = "N/A";
        if (order.created_at && order.created_at.seconds) {
            dateStr = new Date(order.created_at.seconds * 1000).toLocaleDateString();
        }

        const id = order.id || "";

        let custName = order.customer_name || "Unknown";
        let custEmail = order.customer_email || "";

        if (custName === "Unknown" && order.customer_id && customers[order.customer_id]) {
            custName = customers[order.customer_id].name;
            custEmail = customers[order.customer_id].email;
        }

        let itemsStr = "";
        if (order.items && Array.isArray(order.items)) {
            itemsStr = order.items.map(i => `${i.qty}x ${i.name}`).join("; ");
        } else if (order.step1_data) {
            itemsStr = `${order.step1_data.category}`;
        }
        itemsStr = itemsStr.replace(/"/g, '""');

        const amount = order.amount_paid || order.total_price || 0;

        const row = [
            dateStr,
            id,
            `"${custName}"`,
            custEmail,
            `"${itemsStr}"`,
            amount
        ].join(",");

        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
}

// =============================================================================
// GALLERY MANAGEMENT (Milestone 11)
// =============================================================================

let galleryItems = []; // All items
let galleryCategories = []; // All categories
let currentGalleryFilter = 'all';
let selectedFiles = [];
// Drag-and-Drop State
let isReordering = false;
let sortableInstance = null;

async function initGallery() {
    // Fetch categories
    const categoriesSnap = await getDocs(query(collection(db, 'gallery_categories'), orderBy('sort_order')));
    galleryCategories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch items
    const itemsSnap = await getDocs(query(collection(db, 'gallery_items'), orderBy('sort_order')));
    galleryItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderGalleryFilters();
    renderGalleryGrid();
    updateGalleryStats();
    initSortable(); // Initialize drag-and-drop

    // Event listeners
    document.getElementById('btn-upload-images').addEventListener('click', openUploadModal);
    document.getElementById('btn-manage-categories').addEventListener('click', openCategoryManagerModal);
}

// Initialize SortableJS
function initSortable() {
    const grid = document.getElementById('admin-gallery-grid');
    sortableInstance = new Sortable(grid, {
        animation: 150,
        disabled: true, // Disabled by default until "Reorder" is clicked
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: handleReorder
    });
}

// Toggle Reorder Mode
window.toggleReorderMode = function () {
    isReordering = !isReordering;
    const btn = document.getElementById('btn-reorder-mode');
    const grid = document.getElementById('admin-gallery-grid');

    if (isReordering) {
        // Enable Sorting
        sortableInstance.option("disabled", false);
        grid.classList.add('reorder-mode');
        btn.classList.add('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 13l4 4L19 7" />
            </svg>
            Done Reordering
        `;
        // Disable other controls
        document.getElementById('btn-upload-images').disabled = true;
        document.getElementById('btn-manage-categories').disabled = true;
        // Check if filter is 'all'
        if (currentGalleryFilter !== 'all') {
            alert("Note: You can only reorder when viewing 'All' items. Switching to All now.");
            filterGallery('all');
        }
    } else {
        // Disable Sorting
        sortableInstance.option("disabled", true);
        grid.classList.remove('reorder-mode');
        btn.classList.remove('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            Reorder Items
        `;
        // Enable other controls
        document.getElementById('btn-upload-images').disabled = false;
        document.getElementById('btn-manage-categories').disabled = false;

        // Refresh grid to ensure sort order conformity (optional but safe)
        renderGalleryGrid();
    }
};

// Handle Drop Event
async function handleReorder(evt) {
    if (evt.oldIndex === evt.newIndex) return;

    const itemEl = evt.item;
    const movedItemId = itemEl.dataset.id;

    // Get current visible items (should be ALL if enforced)
    // We reuse galleryItems because we force 'all' filter
    // But wait, renderGalleryGrid() might filter items visually. 
    // Sortable works on DOM elements.
    // If filter is active, indices won't match global galleryItems indices.
    // We forced 'all' filter in toggleReorderMode, so grid matches galleryItems (mostly).
    // EXCEPT hidden items? No, admins see hidden items.
    // So grid should match galleryItems exactly if filtered by 'all'.

    // 1. Update local array
    const movedItem = galleryItems[evt.oldIndex];
    galleryItems.splice(evt.oldIndex, 1);
    galleryItems.splice(evt.newIndex, 0, movedItem);

    // 2. Prepare Batch Update
    const batch = writeBatch(db);
    let updateCount = 0;

    // Optimally, only update items strictly between min(old, new) and max(old, new)
    // But updating all is safer for consistency if array is small < 500
    // Let's update all for simplicity and robustness

    galleryItems.forEach((item, index) => {
        if (item.sort_order !== index) {
            item.sort_order = index; // Update local
            const ref = doc(db, 'gallery_items', item.id);
            batch.update(ref, { sort_order: index });
            updateCount++;
        }
    });


    try {
        await batch.commit();
        showNotification('✓ New order saved!', 'success');
    } catch (err) {
        console.error("Error reordering:", err);
        showNotification('Error saving order: ' + err.message, 'error');
        // Revert UI if needed? For now, just alert.
    }
}

function renderGalleryFilters() {
    const container = document.getElementById('admin-gallery-filters');
    container.innerHTML = '';

    galleryCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (cat.slug === currentGalleryFilter ? ' active' : '');
        btn.textContent = cat.label;
        btn.dataset.slug = cat.slug;
        btn.addEventListener('click', () => {
            currentGalleryFilter = cat.slug;
            renderGalleryFilters();
            renderGalleryGrid();
        });
        container.appendChild(btn);
    });
}

function renderGalleryGrid() {
    const grid = document.getElementById('admin-gallery-grid');
    const emptyState = document.getElementById('gallery-empty-state');

    let filteredItems = galleryItems;
    if (currentGalleryFilter !== 'all') {
        filteredItems = galleryItems.filter(item => item.categories && item.categories.includes(currentGalleryFilter));
    }

    if (filteredItems.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.style.cssText = 'position:relative; border-radius:8px; overflow:hidden; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.1);' + (item.visible ? '' : 'opacity:0.5;');

        const img = document.createElement('img');
        img.src = item.thumb_url || item.image_url;
        img.alt = item.display_name;
        img.style.cssText = 'width:100%; height:200px; object-fit:cover;';
        card.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'gallery-card-overlay';
        overlay.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; gap:0.5rem; opacity:0; transition:opacity 0.2s;';
        card.addEventListener('mouseenter', () => overlay.style.opacity = '1');
        card.addEventListener('mouseleave', () => overlay.style.opacity = '0');

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '✏️';
        editBtn.style.cssText = 'background:white; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:16px;';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditImageModal(item.id);
        });
        overlay.appendChild(editBtn);

        // Visibility toggle
        const visBtn = document.createElement('button');
        visBtn.innerHTML = item.visible ? '👁️' : '🙈';
        visBtn.style.cssText = 'background:white; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:16px;';
        visBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await updateDoc(doc(db, 'gallery_items', item.id), { visible: !item.visible });
            item.visible = !item.visible;
            renderGalleryGrid();
            updateGalleryStats();
        });
        overlay.appendChild(visBtn);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '🗑️';
        delBtn.style.cssText = 'background:white; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:16px;';
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${item.display_name}"?`)) return;

            try {
                // Delete from Firestore
                await deleteDoc(doc(db, 'gallery_items', item.id));

                // Delete from Storage
                const storageRef = ref(storage, item.storage_path);
                await deleteObject(storageRef);

                // Remove from memory
                galleryItems = galleryItems.filter(i => i.id !== item.id);
                renderGalleryGrid();
                updateGalleryStats();
                alert('Image deleted successfully');
            } catch (err) {
                console.error('Delete error:', err);
                alert('Error deleting image: ' + err.message);
            }
        });
        overlay.appendChild(delBtn);

        card.appendChild(overlay);
        grid.appendChild(card);
    });
}

function updateGalleryStats() {
    document.getElementById('gallery-count-total').textContent = galleryItems.length;
    document.getElementById('gallery-count-visible').textContent = galleryItems.filter(i => i.visible).length;
    document.getElementById('gallery-count-hidden').textContent = galleryItems.filter(i => !i.visible).length;
    document.getElementById('gallery-count-categories').textContent = galleryCategories.length;
}

// Upload Modal
function openUploadModal() {
    const modal = document.getElementById('upload-images-modal');
    modal.classList.remove('hidden');

    // Populate category checkboxes
    const container = document.getElementById('upload-category-checkboxes');
    container.innerHTML = '';
    galleryCategories.filter(c => c.slug !== 'all').forEach(cat => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex; align-items:center; gap:0.25rem; padding:0.5rem; border:1px solid #e5e7eb; border-radius:4px; cursor:pointer;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat.slug;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(cat.label));
        container.appendChild(label);
    });

    // Drag & drop
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('upload-file-input');

    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#10b981';
    };

    dropzone.ondragleave = () => {
        dropzone.style.borderColor = '#e5e7eb';
    };

    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#e5e7eb';
        handleFileSelect(e.dataTransfer.files);
    };

    fileInput.onchange = () => handleFileSelect(fileInput.files);

    // Upload button
    document.getElementById('btn-start-upload').onclick = handleImageUpload;

    // Close modal
    modal.querySelector('.close-modal').onclick = () => {
        modal.classList.add('hidden');
        selectedFiles = [];
        document.getElementById('upload-file-list').innerHTML = '';
        document.getElementById('btn-start-upload').disabled = true;
    };
}

function handleFileSelect(files) {
    selectedFiles = Array.from(files);
    const list = document.getElementById('upload-file-list');
    list.innerHTML = '';

    selectedFiles.forEach(file => {
        const item = document.createElement('div');
        item.textContent = file.name;
        item.style.cssText = 'padding:0.25rem 0; color:#374151;';
        list.appendChild(item);
    });

    document.getElementById('btn-start-upload').disabled = selectedFiles.length === 0;
}

async function handleImageUpload() {
    const checkboxes = document.querySelectorAll('#upload-category-checkboxes input[type="checkbox"]:checked');
    const selectedCategories = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCategories.length === 0) {
        alert('Please select at least one category');
        return;
    }

    if (selectedFiles.length === 0) {
        alert('Please select images to upload');
        return;
    }

    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress');
    const progressText = document.getElementById('upload-progress-text');
    progressContainer.classList.remove('hidden');

    let completed = 0;
    const total = selectedFiles.length;

    for (const file of selectedFiles) {
        try {
            // Upload to Storage
            const storagePath = `gallery/${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Extract metadata
            const nameWithoutExt = file.name.replace(/\.(jpg|jpeg|png)$/i, '');
            const displayName = nameWithoutExt.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const tags = nameWithoutExt.split('-').map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');

            // Create Firestore doc
            const newDoc = await addDoc(collection(db, 'gallery_items'), {
                image_url: downloadURL,
                thumb_url: downloadURL,
                storage_path: storagePath,
                categories: selectedCategories,
                display_name: displayName,
                tags: tags,
                sort_order: galleryItems.length + completed + 1,
                visible: true,
                uploaded_at: serverTimestamp(),
                uploaded_by: currentUser.email
            });

            galleryItems.push({
                id: newDoc.id,
                image_url: downloadURL,
                thumb_url: downloadURL,
                storage_path: storagePath,
                categories: selectedCategories,
                display_name: displayName,
                tags: tags,
                sort_order: galleryItems.length + completed,
                visible: true,
                uploaded_by: currentUser.email
            });

            completed++;
            progressBar.value = (completed / total) * 100;
            progressText.textContent = `Uploaded ${completed}/${total}`;

        } catch (err) {
            console.error('Upload error:', err);
            alert(`Error uploading ${file.name}: ${err.message}`);
        }
    }

    // Close modal and refresh
    document.getElementById('upload-images-modal').classList.add('hidden');
    progressContainer.classList.add('hidden');
    selectedFiles = [];
    renderGalleryGrid();
    updateGalleryStats();
    alert(`Successfully uploaded ${completed}/${total} images`);
}

// Edit Image Modal
function openEditImageModal(imageId) {
    const item = galleryItems.find(i => i.id === imageId);
    if (!item) return;

    const modal = document.getElementById('edit-image-modal');
    modal.classList.remove('hidden');

    document.getElementById('edit-image-id').value = item.id;
    document.getElementById('edit-image-name').value = item.display_name;
    document.getElementById('edit-image-tags').value = item.tags;
    document.getElementById('edit-image-visible').checked = item.visible;

    // Populate category checkboxes
    const container = document.getElementById('edit-image-category-checkboxes');
    container.innerHTML = '';
    galleryCategories.filter(c => c.slug !== 'all').forEach(cat => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex; align-items:center; gap:0.25rem; padding:0.5rem; border:1px solid #e5e7eb; border-radius:4px; cursor:pointer;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat.slug;
        checkbox.checked = item.categories && item.categories.includes(cat.slug);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(cat.label));
        container.appendChild(label);
    });

    // Save button
    document.getElementById('btn-save-image').onclick = async () => {
        const newName = document.getElementById('edit-image-name').value;
        const newTags = document.getElementById('edit-image-tags').value;
        const newVisible = document.getElementById('edit-image-visible').checked;
        const checkboxes = document.querySelectorAll('#edit-image-category-checkboxes input[type="checkbox"]:checked');
        const newCategories = Array.from(checkboxes).map(cb => cb.value);

        try {
            await updateDoc(doc(db, 'gallery_items', item.id), {
                display_name: newName,
                tags: newTags,
                visible: newVisible,
                categories: newCategories
            });

            // Update in memory
            item.display_name = newName;
            item.tags = newTags;
            item.visible = newVisible;
            item.categories = newCategories;

            modal.classList.add('hidden');
            renderGalleryGrid();
            updateGalleryStats();
            alert('Image updated successfully');
        } catch (err) {
            console.error('Update error:', err);
            alert('Error updating image: ' + err.message);
        }
    };

    // Close modal
    modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
}

// Category Manager Modal
function openCategoryManagerModal() {
    const modal = document.getElementById('manage-categories-modal');
    modal.classList.remove('hidden');

    renderCategoriesTable();

    // Add category button
    document.getElementById('btn-add-category').onclick = async () => {
        // Single prompt for Category Name (acts as label)
        const label = prompt('Enter new Category Name:\nExample: Custom Treats');

        if (!label || label.trim() === '') {
            return; // User cancelled or entered empty string
        }

        // Auto-generate slug from label
        // 1. Lowercase
        // 2. Replace spaces with hyphens
        // 3. Remove non-alphanumeric chars (except hyphens)
        const slug = label.trim().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        // Final validation
        if (slug.length < 2) {
            alert('Could not generate a valid slug from that name. Please try a name with letters/numbers.');
            return;
        }

        try {
            const docRef = await addDoc(collection(db, 'gallery_categories'), {
                slug: slug,
                label: label.trim(),
                sort_order: galleryCategories.length,
                created_at: serverTimestamp()
            });

            galleryCategories.push({
                id: docRef.id,
                slug: slug,
                label: label.trim(),
                sort_order: galleryCategories.length
            });

            renderCategoriesTable();
            renderGalleryFilters();
            updateGalleryStats();

            alert(`✓ Category "${label}" added successfully!`);
        } catch (err) {
            console.error('Error adding category:', err);
            alert('Error adding category: ' + err.message);
        }
    };


    // Close modal
    modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
}

function renderCategoriesTable() {
    const tbody = document.getElementById('categories-table-body');
    tbody.innerHTML = '';

    galleryCategories.forEach(cat => {
        const imageCount = galleryItems.filter(item => item.categories && item.categories.includes(cat.slug)).length;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat.label}</td>
            <td>${cat.slug}</td>
            <td>${cat.sort_order}</td>
            <td>${imageCount}</td>
            <td>
                <button class="btn-text" style="color:#ef4444;" onclick="deleteCategory('${cat.id}', '${cat.slug}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteCategory = async function (catId, slug) {
    if (slug === 'all') {
        alert('Cannot delete the "All" category');
        return;
    }

    // Count images in this category
    const imageCount = galleryItems.filter(item => item.categories && item.categories.includes(slug)).length;

    // Strong confirmation - must type category name
    const confirmText = prompt(
        `⚠️ WARNING: Delete category "${slug}"?\n\n` +
        `This category has ${imageCount} image(s).\n` +
        `Images will NOT be deleted, but will lose this category tag.\n\n` +
        `To confirm deletion, type the category name exactly: ${slug}`
    );

    if (confirmText !== slug) {
        if (confirmText !== null) {
            alert('Category deletion cancelled. Name did not match.');
        }
        return;
    }

    try {
        await deleteDoc(doc(db, 'gallery_categories', catId));
        galleryCategories = galleryCategories.filter(c => c.id !== catId);
        renderCategoriesTable();
        renderGalleryFilters();
        updateGalleryStats();
        alert(`✓ Category "${slug}" deleted successfully.\n\n${imageCount} image(s) still exist but are no longer tagged with this category.`);
    } catch (err) {
        console.error('Error deleting category:', err);
        alert('Error deleting category: ' + err.message);
    }
};
