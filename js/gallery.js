// Gallery Dynamic Loading from Firestore (Milestone 11)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State
let categories = [];
let allItems = [];
let currentFilter = 'all';
let lastDoc = null;
const ITEMS_PER_PAGE = 32;

// DOM Elements
const filterContainer = document.getElementById('gallery-filters-dynamic');
const gridContainer = document.getElementById('gallery-grid-dynamic');
const skeletonContainer = document.getElementById('gallery-skeleton');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = lightboxModal.querySelector('.lightbox-img');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxTags = document.getElementById('lightboxTags');
const closeLightbox = lightboxModal.querySelector('.close-lightbox');

// Initialize Gallery
async function initGallery() {
    try {
        // Show skeleton
        skeletonContainer.classList.remove('hidden');

        // Fetch categories
        const categoriesSnap = await getDocs(query(collection(db, 'gallery_categories'), orderBy('sort_order')));
        categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Render filter buttons
        renderFilters();

        // Fetch initial items
        await loadItems(true);

        // Hide skeleton, show grid
        skeletonContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');

        // Check for theme URL param (e.g., ?theme=cakes)
        const urlParams = new URLSearchParams(window.location.search);
        const themeParam = urlParams.get('theme');
        if (themeParam) {
            const matchingCategory = categories.find(cat => cat.slug === themeParam);
            if (matchingCategory) {
                currentFilter = themeParam;
                renderFilters();
                await loadItems(true);
            }
        }

    } catch (error) {
        console.error('Error initializing gallery:', error);
        skeletonContainer.classList.add('hidden');
        gridContainer.innerHTML = '<p style="text-align:center; color:var(--color-text-muted);">Error loading gallery. Please refresh the page.</p>';
    }
}

// Render Filter Buttons
function renderFilters() {
    filterContainer.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (cat.slug === currentFilter ? ' active' : '');
        btn.textContent = cat.label;
        btn.dataset.filter = cat.slug;
        btn.addEventListener('click', async () => {
            if (currentFilter === cat.slug) return; // Already active
            currentFilter = cat.slug;
            renderFilters();
            gridContainer.innerHTML = ''; // Clear grid
            lastDoc = null; // Reset pagination
            await loadItems(true);
        });
        filterContainer.appendChild(btn);
    });
}

// Load Gallery Items
async function loadItems(resetGrid = false) {
    try {
        if (resetGrid) {
            gridContainer.innerHTML = '';
            lastDoc = null;
        }

        // Build query
        let q;
        if (currentFilter === 'all') {
            q = query(
                collection(db, 'gallery_items'),
                where('visible', '==', true),
                orderBy('sort_order'),
                limit(ITEMS_PER_PAGE)
            );
        } else {
            q = query(
                collection(db, 'gallery_items'),
                where('visible', '==', true),
                where('categories', 'array-contains', currentFilter),
                orderBy('sort_order'),
                limit(ITEMS_PER_PAGE)
            );
        }

        // Add pagination cursor if not first load
        if (lastDoc) {
            q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if (resetGrid) {
                gridContainer.innerHTML = '<p style="text-align:center; color:var(--color-text-muted); padding:3rem 0;">No images found in this category.</p>';
            }
            loadMoreBtn.style.display = 'none';
            return;
        }

        // Render items
        snapshot.docs.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            renderGalleryItem(item);
        });

        // Update pagination
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        loadMoreBtn.style.display = snapshot.docs.length === ITEMS_PER_PAGE ? 'block' : 'none';

    } catch (error) {
        console.error('Error loading items:', error);
        gridContainer.innerHTML += '<p style="text-align:center; color:var(--color-text-muted);">Error loading images.</p>';
    }
}

// Render Single Gallery Item
function renderGalleryItem(item) {
    const card = document.createElement('div');
    card.className = 'gallery-item';
    card.dataset.id = item.id;
    card.dataset.category = (item.categories || []).join(',');
    card.dataset.tags = item.tags || '';

    const img = document.createElement('img');
    img.src = item.thumb_url || item.image_url;
    img.alt = item.display_name || 'Gallery Image';
    img.loading = 'lazy';

    card.appendChild(img);

    // Click to open lightbox
    card.addEventListener('click', () => {
        openLightbox(item);
    });

    gridContainer.appendChild(card);
}

// Open Lightbox
function openLightbox(item) {
    lightboxImg.src = item.image_url;
    lightboxImg.alt = item.display_name || 'Gallery Image';
    lightboxTitle.textContent = item.display_name || 'Custom Creation';
    lightboxTags.textContent = item.tags || '';
    lightboxModal.classList.add('active');
}

// Close Lightbox
closeLightbox.addEventListener('click', () => {
    lightboxModal.classList.remove('active');
});

lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
        lightboxModal.classList.remove('active');
    }
});

// Load More Button
loadMoreBtn.addEventListener('click', async () => {
    await loadItems(false);
});

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', initGallery);
