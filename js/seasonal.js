import { db, collection, addDoc, serverTimestamp } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('seasonal-order-form');
    const numSetsSelect = document.getElementById('num-sets');
    const teacherNamesContainer = document.getElementById('teacher-names-container');
    const priceCalculator = document.getElementById('price-calculator');
    const totalPriceDisplay = document.getElementById('total-price-display');
    const crayonBonusMsg = document.getElementById('crayon-bonus-msg');
    
    const paymentSection = document.getElementById('payment-section');
    const venmoAmount = document.getElementById('venmo-amount');
    
    const waitlistForm = document.getElementById('waitlist-form');
    const waitlistSuccess = document.getElementById('waitlist-success');

    if (numSetsSelect) {
        numSetsSelect.addEventListener('change', (e) => {
            const numSets = parseInt(e.target.value, 10);
            
            // Dynamic teacher fields
            teacherNamesContainer.innerHTML = '';
            for (let i = 1; i <= numSets; i++) {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                formGroup.style.animation = `fadeIn 0.3s ease forwards`;
                formGroup.style.animationDelay = `${i * 0.1}s`;
                
                const label = document.createElement('label');
                label.htmlFor = `teacher-name-${i}`;
                label.textContent = `Teacher ${i} Name (for Apple Cookie)`;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `teacher-name-${i}`;
                input.required = true;
                input.placeholder = "e.g., Mrs. Smith";
                
                formGroup.appendChild(label);
                formGroup.appendChild(input);
                teacherNamesContainer.appendChild(formGroup);
            }
            
            // Auto price display
            const price = numSets * 20;
            totalPriceDisplay.textContent = `$${price}`;
            priceCalculator.style.display = 'block';
            
            if (numSets >= 3) {
                crayonBonusMsg.style.display = 'block';
            } else {
                crayonBonusMsg.style.display = 'none';
            }
        });
    }

    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submit-order-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Reserving...';
            
            const parentName = document.getElementById('parent-name').value;
            const parentEmail = document.getElementById('parent-email').value;
            const parentPhone = document.getElementById('parent-phone').value;
            const pickupDate = document.getElementById('pickup-date').value;
            const numSets = parseInt(document.getElementById('num-sets').value, 10);
            
            // Validate pickup date is in May 2026
            if (!pickupDate.startsWith('2026-05')) {
                alert('Pickup date must be in May 2026.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reserve & Continue to Payment';
                return;
            }
            
            const teacherNames = [];
            for (let i = 1; i <= numSets; i++) {
                const val = document.getElementById(`teacher-name-${i}`).value;
                if (val) teacherNames.push(val);
            }
            
            const totalPrice = numSets * 20;
            const freeCrayonBox = numSets >= 3;
            
            const orderData = {
                parent_name: parentName,
                parent_email: parentEmail,
                parent_phone: parentPhone,
                pickup_date: pickupDate,
                num_sets: numSets,
                teacher_names: teacherNames,
                total_price: totalPrice,
                free_crayon_box: freeCrayonBox,
                campaign: "teacher-appreciation-2026",
                campaign_id: "teacher_appreciation_2026",
                status: "PENDING_PAYMENT",
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            };
            
            try {
                await addDoc(collection(db, "seasonal_orders"), orderData);
                
                // Show success
                orderForm.style.display = 'none';
                venmoAmount.textContent = `$${totalPrice}`;
                paymentSection.style.display = 'block';
                
            } catch (err) {
                console.error("Error submitting seasonal order:", err);
                alert("There was an error reserving your sets. Please try again.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reserve & Continue to Payment';
            }
        });
    }

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-waitlist-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Joining...';
            
            const name = document.getElementById('waitlist-name').value;
            const email = document.getElementById('waitlist-email').value;
            
            const waitlistData = {
                name: name,
                email: email,
                campaign: "teacher-appreciation-2026",
                created_at: serverTimestamp()
            };
            
            try {
                await addDoc(collection(db, "seasonal_waitlist"), waitlistData);
                waitlistForm.style.display = 'none';
                waitlistSuccess.style.display = 'block';
            } catch (err) {
                console.error("Error joining waitlist:", err);
                alert("Error joining waitlist. Please try again.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Join Waitlist';
            }
        });
    }
});
