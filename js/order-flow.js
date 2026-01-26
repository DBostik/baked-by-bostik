/* Order Flow Step 2 Script */

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // In a real app, we would POST this data to a backend.
        // For this demo, we simulate success.

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.disabled = true;
        btn.innerText = "Sending...";

        setTimeout(() => {
            // alert("Thanks, Kristen will follow up by email within 24 to 48 hours.");
            sessionStorage.removeItem('orderStep1'); // Clear data
            sessionStorage.removeItem('galleryReference'); // Clear any ref
            window.location.href = 'thank-you.html';
        }, 1500);
    });
}
