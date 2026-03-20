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
            } else {
                // Feature: Tag-based filtering via URL for homepage themes
                currentFilter = 'all'; // Load all categories
                window.activeTagFilter = themeParam.toLowerCase(); // Set global tag filter
                
                // Add a visual indicator
                const header = document.querySelector('.page-header h1');
                if (header) {
                    header.textContent = `Gallery: ${themeParam.charAt(0).toUpperCase() + themeParam.slice(1)}`;
                }
                
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

    if (window.activeTagFilter) {
        const tagLabel = window.activeTagFilter.split(',').map(t => t.trim() ? t.trim().charAt(0).toUpperCase() + t.trim().slice(1) : '').filter(Boolean).join(', ');
        const tagBtn = document.createElement('button');
        tagBtn.className = 'filter-btn active';
        tagBtn.textContent = 'Tag: ' + tagLabel + ' ✕';
        tagBtn.title = 'Clear tag filter';
        tagBtn.addEventListener('click', async () => {
            window.activeTagFilter = null;
            const url = new URL(window.location);
            url.searchParams.delete('theme');
            window.history.pushState({}, '', url);
            const header = document.querySelector('.page-header h1');
            if (header) header.textContent = 'Gallery';
            
            currentFilter = 'all';
            renderFilters();
            gridContainer.innerHTML = ''; 
            lastDoc = null; 
            await loadItems(true);
        });
        filterContainer.appendChild(tagBtn);
    }

    categories.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = (cat.slug === currentFilter && !window.activeTagFilter);
        btn.className = 'filter-btn' + (isActive ? ' active' : '');
        btn.textContent = cat.label;
        btn.dataset.filter = cat.slug;
        btn.addEventListener('click', async () => {
            if (cat.slug === currentFilter && !window.activeTagFilter) return; // Already active
            currentFilter = cat.slug;
            
            // Clear URL and active tag filter
            if (window.activeTagFilter) {
                window.activeTagFilter = null;
                const url = new URL(window.location);
                url.searchParams.delete('theme');
                window.history.pushState({}, '', url);
                const header = document.querySelector('.page-header h1');
                if (header) header.textContent = 'Gallery';
            }
            
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
        const fetchLimit = window.activeTagFilter ? 999 : ITEMS_PER_PAGE;
        
        if (currentFilter === 'all') {
            q = query(
                collection(db, 'gallery_items'),
                where('visible', '==', true),
                orderBy('sort_order'),
                limit(fetchLimit)
            );
        } else {
            q = query(
                collection(db, 'gallery_items'),
                where('visible', '==', true),
                where('categories', 'array-contains', currentFilter),
                orderBy('sort_order'),
                limit(fetchLimit)
            );
        }

        // Add pagination cursor if not first load
        if (lastDoc && !window.activeTagFilter) {
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
        let renderedCount = 0;
        snapshot.docs.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            // Tag filtering
            if (window.activeTagFilter) {
                const searchString = `${item.display_name || ''} ${item.tags || ''}`.toLowerCase();
                const filterTags = window.activeTagFilter.split(',').map(t => t.trim()).filter(t => t.length > 0);
                
                const matches = filterTags.some(tag => searchString.includes(tag));
                if (!matches) {
                    return; // Skip rendering
                }
            }
            renderGalleryItem(item);
            renderedCount++;
        });

        if (renderedCount === 0 && window.activeTagFilter && resetGrid) {
            gridContainer.innerHTML = '<p style="text-align:center; color:var(--color-text-muted); padding:3rem 0;">No images found for this theme.</p>';
        }

        // Update pagination
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (window.activeTagFilter) {
            loadMoreBtn.style.display = 'none'; // Everything loaded at once for tag filters
        } else {
            loadMoreBtn.style.display = snapshot.docs.length === ITEMS_PER_PAGE ? 'block' : 'none';
        }

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
