import { db, collection, addDoc, doc, setDoc, serverTimestamp } from './firebase-init.js';

console.log("Firebase Handler Module Loading...");

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
