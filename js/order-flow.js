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
    document.getElementById('reviewName').innerText = data.name;
    document.getElementById('reviewDate').innerText = data.date;
    document.getElementById('reviewType').innerText = data.type;

    // Populate Hidden Fields
    document.getElementById('hiddenName').value = data.name;
    document.getElementById('hiddenEmail').value = data.email;
    document.getElementById('hiddenDate').value = data.date;
    document.getElementById('hiddenType').value = data.type;
    document.getElementById('hiddenQty').value = data.qty;

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const requestId = sessionStorage.getItem('requestId');
            if (!requestId) {
                // Determine fallback if ID missing? For now, alert.
                // In production, we might want to fail gracefully or just create a new orphaned request.
                // But for this flow, ID is required.
                throw new Error("Missing Request ID. Please start over.");
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
                    // Create path: requests/{requestId}/{timestamp}_{filename}
                    const filePath = `requests/${requestId}/${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, filePath);

                    try {
                        const snapshot = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(snapshot.ref);
                        imageUrls.push(downloadURL);
                    } catch (uploadErr) {
                        console.error("Upload failed for", file.name, uploadErr);
                        alert(`Failed to upload ${file.name}. Check your internet or Storage Rules. Error: ${uploadErr.message}`);
                    }
                }
            }

            btn.innerText = "Saving Details...";

            // Prepare update payload matching Data Model
            const updatePayload = {
                status: 'AWAITING_DETAILS',
                step2_data: {
                    occasion: data.occasion,
                    occasion_other: (data.occasion === 'other') ? "See notes" : null, // or add field if UI exists
                    theme_keywords: data.theme,
                    colors: data.colors,
                    complexity: data.complexity,
                    budget_range: data.budget,
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

            window.location.href = 'thank-you.html';

        } catch (error) {
            console.error("Error updating request:", error);
            alert("Error sending request: " + error.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}
