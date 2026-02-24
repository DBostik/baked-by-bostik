/* Order Flow Step 2 Script */
import { db, doc, updateDoc, serverTimestamp, storage, ref, uploadBytes, getDownloadURL } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', () => {
    loadStep1Data();
    initFormSubmit();
});

function loadStep1Data() {
    const dataString = sessionStorage.getItem('orderStep1');
    if (!dataString) {
        // Redirect back home if no step 1 data
        alert("Please start your order from the main page.");
        window.location.href = 'index.html';
        return;
    }

    const data = JSON.parse(dataString);

    // Populate Review Box
    const phoneDisplay = data.phone ? ` · 📞 ${data.phone}` : '';
    document.getElementById('reviewName').innerText = data.name + phoneDisplay;
    document.getElementById('reviewDate').innerText = data.date;
    document.getElementById('reviewType').innerText = data.type;

    // Populate Hidden Fields
    document.getElementById('hiddenName').value = data.name;
    document.getElementById('hiddenEmail').value = data.email;
    document.getElementById('hiddenDate').value = data.date;
    document.getElementById('hiddenType').value = data.type;
    document.getElementById('hiddenQty').value = data.qty;
    document.getElementById('hiddenPhone').value = data.phone || '';

    // Check for Gallery Reference
    const galleryRef = sessionStorage.getItem('galleryReference');
    if (galleryRef) {
        const themeInput = document.querySelector('input[name="theme"]');
        if (themeInput) {
            themeInput.value = "Like: " + galleryRef;
        }
        // Optional: Clear it so it doesn't persist forever, or keep it.
        // sessionStorage.removeItem('galleryReference'); 
    }
}

function initFormSubmit() {
    const form = document.getElementById('step2Form');

    // File Input UI Feedback
    const fileInput = document.getElementById('inspirationImages');
    const fileListDisplay = document.getElementById('file-list');

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            fileListDisplay.innerHTML = '';
            if (fileInput.files.length > 0) {
                Array.from(fileInput.files).forEach(file => {
                    const div = document.createElement('div');
                    div.style.fontSize = "0.9em";
                    div.style.marginBottom = "0.25rem";
                    div.innerHTML = `✅ <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
                    fileListDisplay.appendChild(div);
                });
            }
        });
    }

    // Allergy Toggle Logic
    const allergySelect = document.getElementById('allergiesSelect');
    const allergyDetails = document.getElementById('allergyDetailsContainer');

    if (allergySelect && allergyDetails) {
        allergySelect.addEventListener('change', (e) => {
            if (e.target.value === 'yes') {
                allergyDetails.style.display = 'block';
                const input = allergyDetails.querySelector('input');
                if (input) input.required = true;
            } else {
                allergyDetails.style.display = 'none';
                const input = allergyDetails.querySelector('input');
                if (input) {
                    input.required = false;
                    input.value = '';
                }
            }
        });
    }

    // Referral Name Toggle Logic
    const hearAboutUsSelect = document.getElementById('hearAboutUsSelect');
    const referralDetails = document.getElementById('referralNameContainer');

    if (hearAboutUsSelect && referralDetails) {
        hearAboutUsSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Friend/Family Referral') {
                referralDetails.style.display = 'block';
                const input = referralDetails.querySelector('input');
                if (input) input.required = true;
            } else {
                referralDetails.style.display = 'none';
                const input = referralDetails.querySelector('input');
                if (input) {
                    input.required = false;
                    input.value = '';
                }
            }
        });
    }

    // Add-ons Toggle Logic
    const addons = [
        { check: 'addonCookies', details: 'addonCookiesDetails' },
        { check: 'addonCupcakes', details: 'addonCupcakesDetails' },
        { check: 'addonCake', details: 'addonCakeDetails' }
    ];

    addons.forEach(addon => {
        const checkbox = document.getElementById(addon.check);
        const details = document.getElementById(addon.details);
        if (checkbox && details) {
            checkbox.addEventListener('change', (e) => {
                const input = details.querySelector('input');
                if (e.target.checked) {
                    details.style.display = 'block';
                    if (input) input.required = true;
                } else {
                    details.style.display = 'none';
                    if (input) {
                        input.required = false;
                        input.value = '';
                    }
                }
            });
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const requestId = sessionStorage.getItem('requestId');
            if (!requestId) {
                throw new Error("Missing request ID. Please restart the order.");
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // --- IMAGE UPLOAD LOGIC ---
            const imageUrls = [];
            const files = document.getElementById('inspirationImages').files;

            if (files && files.length > 0) {
                btn.innerText = "Uploading Photos...";

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const filePath = `requests/${requestId}/${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, filePath);

                    try {
                        const snapshot = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(snapshot.ref);
                        imageUrls.push(downloadURL);
                    } catch (uploadErr) {
                        console.error("Upload failed for", file.name, uploadErr);
                    }
                }
            }

            btn.innerText = "Saving Details...";

            // Construct Source String
            let source = data.hear_about_us || "Not specified";
            if (data.hear_about_us === 'Friend/Family Referral' && data.referral_name) {
                source += `: ${data.referral_name}`;
            }

            // --- ADD-ONS LOGIC ---
            const addOns = [];
            if (data.addon_cookies_check) {
                addOns.push({ type: 'Cookies', qty: data.addon_cookies_qty + ' dozen' });
            }
            if (data.addon_cupcakes_check) {
                addOns.push({ type: 'Cupcakes', qty: data.addon_cupcakes_qty + ' dozen' });
            }
            if (data.addon_cake_check) {
                addOns.push({ type: 'Cake', qty: data.addon_cake_details });
            }

            // Prepare update payload
            const updatePayload = {
                status: 'AWAITING_DETAILS',
                step2_data: {
                    occasion: data.occasion,
                    occasion_other: (data.occasion === 'other') ? "See notes" : null,
                    theme_keywords: data.theme,
                    colors: data.colors,
                    complexity: data.complexity,
                    budget_range: data.budget,
                    add_ons: addOns,
                    allergies: data.allergies,
                    allergy_details: (data.allergies === 'yes') ? data.allergy_details : "None",
                    hear_about_us: source,
                    notes: data.notes,
                    inspiration_images: imageUrls,
                    email_opt_in: !!data.emailOptIn
                },
                updated_at: serverTimestamp()
            };

            const requestRef = doc(db, "requests", requestId);
            await updateDoc(requestRef, updatePayload);

            // Clean up session
            sessionStorage.removeItem('orderStep1');
            sessionStorage.removeItem('galleryReference');
            sessionStorage.removeItem('requestId');

            console.log("Order submitted successfully. Redirecting to thank-you.html...");
            window.location.href = '/thank-you.html';

        } catch (error) {
            console.error("Error updating request:", error);
            alert("Error sending request: " + error.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}
