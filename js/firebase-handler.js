import { db, collection, addDoc, doc, getDoc, setDoc, getDocs, query, orderBy, limit, serverTimestamp } from './firebase-init.js';

console.log("Firebase Handler Module Loading...");

// --- Fetch Site Content for Homepage ---
document.addEventListener('DOMContentLoaded', async () => {
    // Only fetch if we are on the homepage (check for hero-img)
    const heroImg = document.querySelector('.hero-img');
    const themesGrid = document.querySelector('.themes-grid');
    
    if (heroImg || themesGrid) {
        try {
            const docRef = doc(db, 'site_content', 'homepage');
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
                const data = snap.data();
                
                // 1. Setup Single Hero Image
                if (data.hero_single && data.hero_single.url && heroImg) {
                    heroImg.src = data.hero_single.url;
                }
                
                // 1.5 Setup Featured Work Strip
                const featuredGrid = document.querySelector('.featured-grid');
                if (data.featured && data.featured.length > 0 && featuredGrid) {
                    const featuredItems = featuredGrid.querySelectorAll('.featured-item img');
                    featuredItems.forEach((img, index) => {
                        if (data.featured[index] && data.featured[index].url) {
                            img.src = data.featured[index].url;
                        }
                    });
                }
                
                // 2. Setup Theme Cards
                if (data.themes && data.themes.length > 0 && themesGrid) {
                    const themeCards = themesGrid.querySelectorAll('.theme-card');
                    themeCards.forEach((card, index) => {
                        if (data.themes[index]) {
                            const tData = data.themes[index];
                            const img = card.querySelector('img');
                            const h3 = card.querySelector('h3');
                            if (img && tData.url) {
                                img.src = tData.url;
                            }
                            // Only override title if it's not a generic placeholder
                            if (h3 && tData.title && !tData.title.startsWith('Theme ')) {
                                h3.textContent = tData.title;
                            }
                            // Override link href using explicit tag or title fallback
                            if (tData.link) {
                                card.href = `gallery?theme=${encodeURIComponent(tData.link)}`;
                            } else if (tData.title && !tData.title.startsWith('Theme ')) {
                                const tagSlug = tData.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                card.href = `gallery?theme=${tagSlug}`;
                            }
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Error loading site content:", err);
        }

        // --- Fetch Reviews for Homepage ---
        try {
            console.log("Fetching reviews...");
            const qReviews = query(collection(db, 'reviews'), orderBy('created_at', 'desc'), limit(10));
            const reviewSnaps = await getDocs(qReviews);
            console.log("reviewSnaps size:", reviewSnaps.size);
            
            const reviewData = [];
            reviewSnaps.forEach(docSnap => {
                reviewData.push({ id: docSnap.id, ...docSnap.data() });
            });
            console.log("reviewData array:", reviewData);
            if (window.renderTestimonials) {
                console.log("Calling renderTestimonials...");
                window.renderTestimonials(reviewData);
            } else {
                console.error("window.renderTestimonials is NOT defined");
            }
        } catch(err) {
            console.error("Error loading reviews:", err);
        }
    }
});

window.handleOrderSubmit = async (e, form) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // 1. Create/Update Customer (Blind Write using Email as ID)
        // This avoids needing "Read" permissions on the public form.
        const customerId = data.email.toLowerCase().trim();
        const customerRef = doc(db, "customers", customerId);

        await setDoc(customerRef, {
            name: data.name,
            email: data.email,
            phone: data.phone,
            last_updated: serverTimestamp()
            // We use merge:true usually, but setDoc without options overwrites. 
            // setDoc(ref, data, { merge: true }) preserves other fields (like notes).
        }, { merge: true });

        // If it's a new doc, create_at might be missing, but 'last_updated' is enough for now.

        // 2. Create Request (Custom ID: MMDDYYYY-XXXX)
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const yyyy = now.getFullYear();
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
        const customRequestId = `${mm}${dd}${yyyy}-${randomSuffix}`;

        const requestRef = doc(db, "requests", customRequestId);

        await setDoc(requestRef, {
            customer_id: customerId,
            status: 'NEW', // Initial status
            step1_data: {
                category: data.type,
                event_date: data.date,
                quantity_value: data.qty,
                phone: data.phone,
                fulfillment: data.delivery, // pickup or delivery
                delivery_zip: data.zip || null,
                rush_flag: (document.getElementById('rush-warning').style.display === 'block'),
                pickup_window: data.pickup_window || 'Not sure yet'
            },
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });

        const newRequest = { id: customRequestId }; // Mock the return obj of addDoc

        // 3. Save Context
        sessionStorage.setItem('requestId', newRequest.id);
        // Still save Step 1 data for UI display in Step 2, keeping legacy behavior
        sessionStorage.setItem('orderStep1', JSON.stringify(data));

        // 4. Redirect
        window.location.href = '/order.html';

    } catch (error) {
        console.error("Error submitting request:", error);
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
