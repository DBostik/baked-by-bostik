/* Gallery Filter & Lightbox Logic */
document.addEventListener('DOMContentLoaded', () => {
    initGalleryFilters();
    initLightbox();
    checkUrlParams();
});

/* Filter & Pagination Logic */
let currentFilter = 'all';
let itemsToShow = 32;
const itemsIncrement = 32;

function initGalleryFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    // Initial Render
    filterAndRender();

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logic Update
            currentFilter = btn.getAttribute('data-filter');
            itemsToShow = itemsIncrement; // Reset count
            filterAndRender();
        });
    });

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            itemsToShow += itemsIncrement;
            filterAndRender();
        });
    }
}

function filterAndRender() {
    const items = Array.from(document.querySelectorAll('.gallery-item'));
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    // 1. Identify valid items based on filter
    const visibleItems = items.filter(item => {
        const categories = item.getAttribute('data-category');
        return currentFilter === 'all' || categories.includes(currentFilter);
    });

    // 2. Hide ALL items first (simplest approach)
    items.forEach(item => item.style.display = 'none');

    // 3. Show the subset based on itemsToShow
    const slice = visibleItems.slice(0, itemsToShow);

    slice.forEach(item => {
        item.style.display = 'block';
        // Simple fade in if not already visible
        if (item.style.opacity !== '1') {
            item.style.opacity = '0';
            setTimeout(() => item.style.opacity = '1', 50);
        }
    });

    // 4. Update Button State
    if (loadMoreBtn) {
        if (itemsToShow >= visibleItems.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-block';
        }
    }
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');

    if (theme) {
        const filterBtn = document.querySelector(`.filter-btn[data-filter="${theme}"]`);
        if (filterBtn) {
            filterBtn.click();
        }
    }
}

function initLightbox() {
    const modal = document.getElementById('lightboxModal');
    const modalImg = date = modal.querySelector('.lightbox-img');
    const modalTitle = document.getElementById('lightboxTitle');
    const modalTags = document.getElementById('lightboxTags'); // New element
    const closeBtn = document.querySelector('.close-lightbox');
    const items = document.querySelectorAll('.gallery-item');

    items.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            const tags = item.getAttribute('data-tags');

            modal.querySelector('.lightbox-img').src = img.src;
            // Use tags if available, else fallback
            modalTitle.innerText = "Custom Creation";
            if (modalTags) {
                modalTags.innerText = tags ? tags : "";
            }

            modal.classList.add('active');
            document.body.classList.add('no-scroll');

            // Update button onclick
            const requestBtn = modal.querySelector('.btn-primary');
            if (requestBtn) {
                requestBtn.onclick = () => requestFromGallery(tags);
            }
        });
    });

    closeBtn.addEventListener('click', closeLightbox);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeLightbox();
        }
    });

    function closeLightbox() {
        modal.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }
}
