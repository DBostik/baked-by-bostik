/* App.js - Main Logic */

document.addEventListener('DOMContentLoaded', () => {
    initStickyHeader();
    initScrollAnimations();
    initHeroParallax();
    initOrderModal();
    initTestimonials();
});

/* Sticky Header Effect */
function initStickyHeader() {
    const header = document.querySelector('.site-header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

/* Scroll Animations using Intersection Observer */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // Select elements to animate
    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in-right');
    animatedElements.forEach(el => observer.observe(el));
}

/* Hero Parallax */
function initHeroParallax() {
    const heroImg = document.querySelector('.hero-img');
    if (!heroImg) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;

        // "Move up slightly" relative to the scroll means we want it to translate NEGATIVE (upwards) 
        // OR simply stay put while content scrolls (standard parallax).
        // 0.1 means it moves down very slowly (depth). 
        // -0.1 means it moves up slightly.
        // User complained it "scrolls down with me" (sticky).
        // I will set it to -0.05 to give a tiny upward nudge or 'jump' feel without being sticky.

        const rate = -0.05;

        if (scrolled < 800) {
            heroImg.style.transform = `translateY(${scrolled * rate}px)`;
        }
    });
}

/* Testimonials Logic */
function initTestimonials() {
    const container = document.querySelector('.testimonial-carousel');
    if (!container) return;

    const reviews = [
        { quote: "The unicorn cake was the hit of the party! Not only did it look incredible, but it tasted amazing too.", cite: "Sarah M." },
        { quote: "The best cookies in Glen Ellyn! Kristen captured our theme perfectly.", cite: "Jennifer L." },
        { quote: "Beautiful and delicious. The detail on the Spiderman cake was insane.", cite: "Mike D." },
        { quote: "We order every year for our corporate holiday party. Professional and delicious!", cite: "James T." }
    ];

    // 1. Setup Structure: Wrapper > Track > Items
    container.innerHTML = `<div class="testimonial-track"></div>`;
    const track = container.querySelector('.testimonial-track');

    // 2. Build All Items
    reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'testimonial-item';
        item.innerHTML = `
            <p class="quote">"${review.quote}"</p>
            <cite>- ${review.cite}</cite>
        `;
        track.appendChild(item);
    });

    // 3. Slider Logic
    let currentIndex = 0;
    const totalSlides = reviews.length;

    function slideNext() {
        currentIndex = (currentIndex + 1) % totalSlides;
        const offset = -currentIndex * 100; // -0%, -100%, -200%
        track.style.transform = `translateX(${offset}%)`;
    }

    // Auto-advance
    setInterval(slideNext, 5000);
}

// Note: We need to ensure .testimonial-item has transition: opacity
// I will add the style inline in the JS or check CSS. 
// The previous code had style="transition..." inline.
// I'll keep that pattern but cleaner.

/* Order Modal Logic */
function initOrderModal() {
    // Inject Modal HTML
    const modalHtml = `
    <div id="orderModal" class="modal-overlay" style="display:none;">
        <div class="modal-content fade-in-up">
            <span class="close-modal">&times;</span>
            <h2>Request an Order</h2>
            <p class="modal-subtitle">Step 1 of 2: The Essentials</p>
            
            <form id="step1Form">
                <div class="form-row">
                    <div class="form-group half">
                        <label>Name *</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group half">
                        <label>Email *</label>
                        <input type="email" name="email" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" required placeholder="(555) 123-4567">
                </div>

                <div class="form-row">
                    <div class="form-group half">
                        <label>Order Type *</label>
                        <select name="type" required id="orderTypeSelect">
                            <option value="cookies">Cookies</option>
                            <option value="cakes">Cakes</option>
                            <option value="cupcakes">Cupcakes</option>
                        </select>
                    </div>
                    <div class="form-group half">
                        <label>Event Date *</label>
                        <input type="date" name="date" required id="dateInput">
                    </div>
                </div>
                
                 <div id="rush-warning" style="display:none; color:red; font-size:0.8rem; margin-bottom:10px;">
                    * Date is within 7 days. Rush fee may apply.
                </div>

                <div class="form-group">
                    <label>Preferred Pickup/Delivery Time</label>
                    <select name="pickup_window" id="pickupWindowSelect">
                        <option value="Not sure yet" selected>Not sure yet</option>
                        <option value="9am–11am">9am–11am</option>
                        <option value="11am–1pm">11am–1pm</option>
                        <option value="1pm–3pm">1pm–3pm</option>
                        <option value="3pm–5pm">3pm–5pm</option>
                    </select>
                </div>

                <div class="form-group">
                    <label id="qtyLabel">How many? *</label>
                    <input type="text" name="qty" required placeholder="e.g. 24">
                </div>

                <div class="form-row">
                     <div class="form-group half">
                        <label>Delivery Method</label>
                        <select name="delivery">
                            <option value="pickup">Pickup (Glen Ellyn)</option>
                            <option value="delivery">Delivery</option>
                        </select>
                     </div>
                     <div class="form-group half">
                        <label>Zip Code (If delivery)</label>
                        <input type="text" name="zip">
                     </div>
                </div>

                <button type="submit" class="btn btn-primary full-width">Next Step &rarr;</button>
            </form>
        </div>
    </div>
    <style>
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        }
        .modal-content {
            background: white; padding: 2rem; border-radius: 1rem;
            width: 90%; max-width: 500px; position: relative;
        }
        .close-modal {
            position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; cursor: pointer;
        }
        .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .form-group { flex: 1; display: flex; flex-direction: column; gap: 5px; margin-bottom:1rem; }
        .full-width { width: 100%; }
        input, select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Event Listeners
    const modal = document.getElementById('orderModal');
    const closeBtn = modal.querySelector('.close-modal');
    const form = document.getElementById('step1Form');
    const dateInput = document.getElementById('dateInput');
    const typeInput = document.getElementById('orderTypeSelect');
    const qtyLabel = document.getElementById('qtyLabel');

    closeBtn.onclick = () => { modal.style.display = 'none'; document.body.classList.remove('no-scroll'); };

    // Rush warning logic
    dateInput.addEventListener('change', (e) => {
        const date = new Date(e.target.value);
        const today = new Date();
        const diff = (date - today) / (1000 * 60 * 60 * 24);
        const warning = document.getElementById('rush-warning');
        if (diff < 7 && diff >= 0) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    });

    // Helper text logic
    typeInput.addEventListener('change', (e) => {
        if (e.target.value === 'cakes') {
            qtyLabel.innerText = "Number of people to serve *";
            form.qty.placeholder = "e.g. 20 guests";
            form.qty.type = "text";
        } else {
            qtyLabel.innerText = "How many? *";
            form.qty.placeholder = "e.g. 24";
            form.qty.type = "text";
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        // Retry logic: wait up to 15 seconds (30 attempts) for handler
        let attempts = 0;
        const maxAttempts = 30;

        const checkHandler = async () => {
            if (typeof window.handleOrderSubmit === 'function') {
                await window.handleOrderSubmit(e, form);
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
                return true;
            } else if (attempts < maxAttempts) {
                attempts++;
                // Update button when waiting longer
                if (attempts > 3) submitBtn.innerText = "Connecting...";

                console.log(`Handler not ready, retrying (${attempts}/${maxAttempts})...`);
                await new Promise(r => setTimeout(r, 500));
                return checkHandler();
            } else {
                return false;
            }
        };

        const success = await checkHandler();

        if (!success) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            console.error("Critical Error: window.handleOrderSubmit is not defined after waiting 15s.");
            alert("System Error: The order system is not responding. \n\n1. Check your internet connection.\n2. Disable AdBlock (it may block Firebase).\n3. Refresh the page and try again.");
        }
    };
}

function openOrderModal() {
    console.log("openOrderModal called");
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('no-scroll');
    } else {
        console.error("Modal not found. initOrderModal failed?");
        // Retry init if missing?
        initOrderModal();
        const retryModal = document.getElementById('orderModal');
        if (retryModal) {
            retryModal.style.display = 'flex';
            document.body.classList.add('no-scroll');
        }
    }
}
// Expose to window for HTML onclick access
window.openOrderModal = openOrderModal;

function requestFromGallery(tags) {
    if (tags) {
        sessionStorage.setItem('galleryReference', tags);
    }
    openOrderModal();
    // Close lightbox if open? Usually good UX.
    const lightbox = document.getElementById('lightboxModal');
    if (lightbox && lightbox.classList.contains('active')) {
        lightbox.classList.remove('active');
        // document.body.classList.remove('no-scroll'); // openOrderModal adds this back
    }
}
window.requestFromGallery = requestFromGallery;

/* Mobile Menu Logic */
const mobileToggle = document.querySelector('.mobile-menu-toggle');
const navList = document.querySelector('.nav-list');

if (mobileToggle && navList) {
    mobileToggle.addEventListener('click', () => {
        const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        mobileToggle.setAttribute('aria-expanded', !isExpanded);
        navList.classList.toggle('active');

        // Optional: Animate hamburger to X
        mobileToggle.classList.toggle('open');
        document.body.classList.toggle('no-scroll');
    });

    // Close menu when a link is clicked
    navList.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navList.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.classList.remove('open');
            document.body.classList.remove('no-scroll');
        });
    });
}
