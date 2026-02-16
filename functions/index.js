/**
 * Cloud Functions for Baked By Bostik (V2)
 * - generateQuotePDF: Creates a PDF quote and uploads to Storage
 * - sendQuoteEmail: Sends that PDF via Hostinger SMTP (Nodemailer)
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
// const cors = require("cors")({ origin: true }); // V2 handles CORS natively

admin.initializeApp();

// Set global options if desired, or per function
setGlobalOptions({ maxInstances: 10 });

/**
 * 1. Generate Quote PDF
 * Receives: { requestId, customerName, items: [], totals: {} }
 * Returns: { success: true, url: "..." }
 */
exports.createQuotePDF = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { requestId, customerName, items, totals } = req.body;
        if (!requestId) throw new Error("Missing requestId");

        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // -- STYLES --
        // Mockup Colors
        const colorHeaderBg = '#1F2937'; // Dark Navy/Charcoal
        const colorAccent = '#E5B8B7';   // Light Pink
        const colorText = '#333333';
        const colorWhite = '#FFFFFF';

        // -- HEADER --
        // 1. Background Box
        doc.rect(0, 0, doc.page.width, 130).fill(colorHeaderBg);

        // 2. Logo (Circular Clip)
        const logoPath = './logo.JPG';
        try {
            doc.save();
            doc.circle(90, 65, 45).clip();
            doc.image(logoPath, 45, 20, { width: 90, height: 90 });
            doc.restore();
        } catch (e) {
            console.error("Logo load error:", e);
            doc.circle(90, 65, 45).fill('#FFFFFF');
        }

        // 3. Title & Subtitle (White)
        doc.fillColor(colorWhite);
        doc.font('Helvetica-Bold').fontSize(36).text('Baked By Bostik', 160, 45);
        doc.font('Helvetica').fontSize(12).text('Custom Cakes, Cookies & Cupcakes', 162, 85);

        // 4. Date & ID (Right Aligned)
        doc.fontSize(10).font('Helvetica');
        const rightMargin = 50;
        const pageWidth = doc.page.width;

        doc.text(`Date: ${new Date().toLocaleDateString()}`, 0, 45, { align: 'right', margin: rightMargin, width: pageWidth - rightMargin });
        doc.text(`Request ID: #${requestId.slice(0, 6)}`, 0, 60, { align: 'right', margin: rightMargin, width: pageWidth - rightMargin });

        // Move cursor down past header area
        doc.y = 160;

        // -- CUSTOMER INFO --
        doc.fillColor(colorText).fontSize(12).font('Helvetica-Bold').text('Quote For:', 50);
        doc.font('Helvetica').fontSize(12).text(customerName);

        doc.moveDown(2);

        // -- TABLE HEADER --
        const tableTop = doc.y + 10;

        // Pink Borders
        doc.moveTo(50, tableTop).lineTo(560, tableTop).lineWidth(1).strokeColor(colorAccent).stroke();
        doc.moveTo(50, tableTop + 25).lineTo(560, tableTop + 25).lineWidth(1).strokeColor(colorAccent).stroke();

        doc.fillColor(colorText).font('Helvetica-Bold').fontSize(10);
        const colY = tableTop + 8;
        doc.text('Item Description', 60, colY);
        doc.text('Qty', 350, colY, { width: 40, align: 'center' });
        doc.text('Price', 400, colY, { width: 50, align: 'right' });
        doc.text('Total', 470, colY, { width: 80, align: 'right' });

        doc.moveDown();

        // -- ITEMS --
        let y = tableTop + 35;
        doc.fillColor(colorText).font('Helvetica').fontSize(10);

        items.forEach((item, i) => {
            const name = item.name;
            const price = parseFloat(item.price);
            const qty = parseInt(item.qty);
            const total = price * qty;

            doc.text(name, 60, y, { width: 280 });
            doc.text(qty.toString(), 350, y, { width: 40, align: 'center' });
            doc.text(`$${price.toFixed(2)}`, 400, y, { width: 50, align: 'right' });
            doc.text(`$${total.toFixed(2)}`, 470, y, { width: 80, align: 'right' });

            y += 20;
            if (y > 650) { doc.addPage(); y = 50; }
        });

        // Bottom Line of Table (Pink)
        doc.moveTo(50, y).lineTo(560, y).strokeColor(colorAccent).lineWidth(1).stroke();

        // -- TOTALS BOX & NOTES --
        y += 40;
        const boxTop = y;
        const boxX = 350;
        const boxWidth = 210;

        // Subtotal (Inside Box)
        doc.font('Helvetica').fillColor(colorText).fontSize(10);
        doc.text('Subtotal:', boxX + 10, y + 10, { width: 80, align: 'left' });
        doc.text(`$${totals.subtotal.toFixed(2)}`, boxX + 100, y + 10, { width: 100, align: 'right' });

        let extraRows = 0;
        if (totals.delivery > 0) {
            extraRows += 15;
            doc.text('Delivery:', boxX + 10, y + 10 + extraRows, { width: 80, align: 'left' });
            doc.text(`$${totals.delivery.toFixed(2)}`, boxX + 100, y + 10 + extraRows, { width: 100, align: 'right' });
        }
        if (totals.rush > 0) {
            extraRows += 15;
            doc.text('Rush Fee:', boxX + 10, y + 10 + extraRows, { width: 80, align: 'left' });
            doc.text(`$${totals.rush.toFixed(2)}`, boxX + 100, y + 10 + extraRows, { width: 100, align: 'right' });
        }

        // Total Divider Line
        const lineY = y + 25 + extraRows;
        doc.moveTo(boxX, lineY).lineTo(boxX + boxWidth, lineY).strokeColor('#000000').lineWidth(1).stroke();

        // Total Bold
        doc.font('Helvetica-Bold').fontSize(16).fillColor(colorText);
        doc.text('Total:', boxX + 10, lineY + 10, { width: 80, align: 'left' });
        doc.text(`$${totals.total.toFixed(2)}`, boxX + 100, lineY + 10, { width: 100, align: 'right' });

        const boxHeight = 60 + extraRows;
        // Draw Box Border (Black)
        doc.rect(boxX, boxTop, boxWidth, boxHeight).strokeColor('#000000').lineWidth(1).stroke();

        // Notes (Left Side) - Parallel to box
        if (req.body.notes) {
            const noteY = boxTop;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(colorText);
            doc.text('Notes / Terms:', 50, noteY);
            doc.font('Helvetica').fontSize(9);
            doc.text(req.body.notes, 50, noteY + 15, { width: 250 });
        }

        // -- FOOTER (Signature) --

        // Check if we need a new page based on current y position
        if (y > 640) {
            doc.addPage();
            y = 50;
        }

        // Position Signature
        // Prefer bottom alignment (at 630), but if content pushes close, go flow-relative.
        let sigY = 630;
        if (y > 600) {
            sigY = y + 30;
        }

        doc.font('Helvetica').fontSize(12).fillColor(colorText);
        doc.text('Signature:', 50, sigY);
        doc.moveTo(110, sigY + 10).lineTo(300, sigY + 10).strokeColor('#000000').stroke();

        doc.text('Date:', 350, sigY);
        doc.moveTo(390, sigY + 10).lineTo(510, sigY + 10).strokeColor('#000000').stroke();

        // Branding Footer (Relative to SigY)
        doc.fontSize(10).fillColor('#666666');
        doc.text('Thank you for choosing Baked By Bostik!', 50, sigY + 50, { align: 'center', width: 510 });
        doc.text('hello@bakedbybostik.com', 50, sigY + 65, { align: 'center', width: 510 });

        // Disclaimer / Validity in Fine Print
        doc.fontSize(7).fillColor('#888888');
        const disclaimerText = "ESTIMATE VALIDITY: All pricing estimates are valid for 14 days from the date they are provided. After this period, prices may be subject to change based on ingredient costs and availability. DISCLAIMER: Made in a cottage food bakery not subject to government food inspection. Dyes used may include, but are not limited to Red 40, Red 3, Yellow 5, Yellow 6, Blue 1 & Blue 2. All products are made in a home-based kitchen and may come in contact with known allergens including nuts, peanuts, and soy. You agree to notify your guests of this risk for any allergic reactions. We are not responsible for any allergic reactions to guests consuming the product.";
        doc.text(disclaimerText, 50, sigY + 80, { align: 'center', width: 510 });

        doc.end();

        // Wait for PDF to end
        const pdfBuffer = await new Promise((resolve) => {
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
        });

        // Upload to Storage
        const bucket = admin.storage().bucket();
        const filename = `quotes/${requestId}_${Date.now()}.pdf`;
        const file = bucket.file(filename);

        await file.save(pdfBuffer, {
            metadata: { contentType: 'application/pdf' }
        });

        res.json({ success: true, storagePath: filename });

    } catch (error) {
        console.error("PDF Gen Error", error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * 2. Send Quote Email (SMTP)
 * Receives: { customerEmail, pdfUrl, customerName, emailMessage }
 * Returns: { success: true }
 */
exports.dispatchQuoteEmail = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { customerEmail, pdfUrl, customerName, emailMessage } = req.body;

        const SMTP_EMAIL = process.env.SMTP_EMAIL;
        const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

        if (!SMTP_EMAIL || !SMTP_PASSWORD) {
            console.warn("SMTP credentials missing.");
            return res.json({ success: true, message: "Simulation (SMTP not configured)" });
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true,
            auth: {
                user: SMTP_EMAIL,
                pass: SMTP_PASSWORD
            }
        });

        // Use custom message if provided, else default
        const messageBody = emailMessage || `Hi ${customerName},\n\nPlease find your quote attached at the link below.`;

        const mailOptions = {
            from: `"Baked By Bostik" <orders@bakedbybostik.com>`, // Sending as alias
            replyTo: `orders@bakedbybostik.com`,
            to: customerEmail,
            subject: "Your Quote from Baked By Bostik",
            text: `${messageBody}\n\nQuote Link: ${pdfUrl}\n\nBest,\nBaked By Bostik`,
            html: `<p>${messageBody.replace(/\n/g, '<br>')}</p>
                   <p><a href="${pdfUrl}" style="background:#1A2A3A; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">View Quote PDF</a></p>
                   <p>Best,<br>Baked By Bostik</p>`,

            // Attach the PDF directly
            attachments: [
                {
                    filename: 'Quote.pdf',
                    path: pdfUrl // Nodemailer will fetch this URL
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.info("Email sent: ", info.messageId);

        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("Email Error", error);
        res.status(500).json({ error: error.message });
    }
});

/**
     * 3. Scheduled Weekly Report
     * Triggers every Monday at 9:00 AM (Timezone: America/New_York or default UTC, let's assume default for now or specify)
     */
exports.scheduledWeeklyReport = onSchedule("every monday 09:00", async (event) => {
    try {
        const db = admin.firestore();
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // 1. Calculate Last Week's Revenue
        // Query orders created/paid in last 7 days
        // Note: Ideally query by range, but for simplicity fetch recent and filter
        const ordersSnapshot = await db.collection('orders')
            .where('created_at', '>=', admin.firestore.Timestamp.fromDate(lastWeek))
            .get();

        let weeklyRevenue = 0;
        let ordersCount = 0;

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            // Double check limit (Firestore filter is >= so it handles defaults)
            weeklyRevenue += (parseFloat(data.amount_paid) || parseFloat(data.total_price) || 0);
            ordersCount++;
        });

        // 2. Get Upcoming Orders (Next 7 Days)
        // Query requests where event_date is between today and next week
        // Storing dates as strings YYYY-MM-DD in step1_data.event_date
        // We'll need to fetch active requests and filter in JS because of string format storage
        const requestsSnapshot = await db.collection('requests')
            .where('status', '==', 'BOOKED') // Only confirmed orders
            .get();

        const upcomingOrders = [];
        const nextWeekStr = nextWeek.toISOString().slice(0, 10);
        const todayStr = now.toISOString().slice(0, 10);

        requestsSnapshot.forEach(doc => {
            const data = doc.data();
            const eventDate = data.step1_data?.event_date;
            if (eventDate && eventDate >= todayStr && eventDate <= nextWeekStr) {
                upcomingOrders.push({
                    customer: data.customer_id, // We might need name, but let's just list date/cat
                    date: eventDate,
                    category: data.step1_data.category
                });
            }
        });

        // Sort upcoming
        upcomingOrders.sort((a, b) => a.date.localeCompare(b.date));

        // 3. Construct Email
        const revenueFormatted = `$${weeklyRevenue.toFixed(2)}`;

        let reportText = `Weekly Bakery Performance Report\n\n`;
        reportText += `--- Last Week (since ${lastWeek.toLocaleDateString()}) ---\n`;
        reportText += `Revenue Collected: ${revenueFormatted}\n`;
        reportText += `Orders Processed: ${ordersCount}\n\n`;

        reportText += `--- Upcoming Week (Next 7 Days) ---\n`;
        if (upcomingOrders.length === 0) {
            reportText += `No Booked events found.\n`;
        } else {
            upcomingOrders.forEach(o => {
                reportText += `[${o.date}] ${o.category}\n`;
            });
        }

        const reportHtml = reportText.replace(/\n/g, '<br>');

        // 4. Send Email
        const SMTP_EMAIL = process.env.SMTP_EMAIL;
        const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
        // const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SMTP_EMAIL; // Send to self

        if (SMTP_EMAIL && SMTP_PASSWORD) {
            const transporter = nodemailer.createTransport({
                host: "smtp.hostinger.com",
                port: 465, secure: true,
                auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD }
            });

            await transporter.sendMail({
                from: `"BBB Admin Bot" <${SMTP_EMAIL}>`,
                to: SMTP_EMAIL, // Sending to the admin email
                subject: `Weekly Report: ${revenueFormatted} Revenue`,
                text: reportText,
                html: `<div style="font-family: sans-serif; color: #333;">
                        <h2>Weekly Performance Report</h2>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                            <h3 style="margin-top:0;">Last Week</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #10b981; margin: 10px 0;">${revenueFormatted}</p>
                            <p>${ordersCount} new orders</p>
                        </div>
                        <div>
                            <h3>Upcoming Events</h3>
                            ${upcomingOrders.length ? '<ul>' + upcomingOrders.map(o => `<li><strong>${o.date}</strong>: ${o.category}</li>`).join('') + '</ul>' : '<p>No confirmed events.</p>'}
                        </div>
                       </div>`
            });
            console.log("Weekly report sent.");
        } else {
            console.log("SMTP not configured, skipping email.");
            console.log(reportText);
        }

    } catch (error) {
        console.error("Weekly Report Error:", error);
    }
});
