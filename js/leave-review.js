import { db, collection, addDoc, serverTimestamp } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', () => {
    const starContainer = document.getElementById('star-rating');
    const stars = starContainer ? starContainer.querySelectorAll('.star') : [];
    const ratingInput = document.getElementById('rating-val');

    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            const val = parseInt(e.target.getAttribute('data-val'));
            ratingInput.value = val;
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-val')) <= val) {
                    s.classList.add('active');
                    s.classList.remove('inactive');
                } else {
                    s.classList.remove('active');
                    s.classList.add('inactive');
                }
            });
        });
    });

    const form = document.getElementById('review-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = "Submitting...";

            try {
                const formData = new FormData(form);
                const data = {
                    name: formData.get('name'),
                    event_date: formData.get('event_date'),
                    rating: parseInt(formData.get('rating')),
                    text: formData.get('review_text'),
                    created_at: serverTimestamp()
                };

                await addDoc(collection(db, "pending_reviews"), data);
                
                form.style.display = 'none';
                document.getElementById('success-message').style.display = 'block';
            } catch (err) {
                console.error("Error submitting review:", err);
                alert("Could not submit review. Please try again later. Error: " + err.message);
                btn.disabled = false;
                btn.innerText = "Submit Review";
            }
        });
    }
});
