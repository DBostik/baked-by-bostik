const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = './service-account.json'; // User must provide this
const LOCAL_GALLERY_PATH = '../assets/images/Gallery';
const STORAGE_BUCKET = 'bakedbybostik-5eb55.firebasestorage.app'; // From firebase-config.js

// Category Slugs Mapping
const CATEGORY_MAP = {
    'Cakes': 'cakes',
    'Cookies': 'cookies',
    'Animals & Pets': 'animals',
    'Holidays & Celebrations': 'holidays',
    'Kids & Characters': 'kids',
    'Life Events': 'life',
    'School & Sports': 'school'
};

// The one unique file in "All" folder
const UNIQUE_ALL_FILE = 'cupcakes-blue-white-baby-shower-boy.jpg';

async function main() {
    console.log("🚀 Starting Gallery Migration...");

    // 1. Initialize Firebase Admin
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error(`❌ ERROR: Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
        console.error("Please download it from Firebase Console -> Project Settings -> Service Accounts");
        process.exit(1);
    }

    const serviceAccount = require(SERVICE_ACCOUNT_PATH);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: STORAGE_BUCKET
    });

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // 2. Scan Folders & Build Map
    console.log("📂 Scanning local folders...");
    const fileMap = new Map(); // filename -> { categories: [], originalPath: '' }

    const subdirs = fs.readdirSync(LOCAL_GALLERY_PATH, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const dirName of subdirs) {
        if (dirName === 'All') {
            // Special handling for the one unique file
            const allPath = path.join(LOCAL_GALLERY_PATH, 'All');
            if (fs.existsSync(path.join(allPath, UNIQUE_ALL_FILE))) {
                if (!fileMap.has(UNIQUE_ALL_FILE)) {
                    fileMap.set(UNIQUE_ALL_FILE, {
                        categories: ['life'], // User requested "Life Events"
                        originalPath: path.join(allPath, UNIQUE_ALL_FILE)
                    });
                }
            }
            continue; // Skip the rest of "All"
        }

        const categorySlug = CATEGORY_MAP[dirName];
        if (!categorySlug) {
            console.warn(`⚠️ Warning: Unknown folder "${dirName}", skipping.`);
            continue;
        }

        const dirPath = path.join(LOCAL_GALLERY_PATH, dirName);
        const files = fs.readdirSync(dirPath).filter(f => f.match(/\.(jpg|jpeg|png)$/i));

        for (const file of files) {
            if (!fileMap.has(file)) {
                fileMap.set(file, {
                    categories: [categorySlug],
                    originalPath: path.join(dirPath, file)
                });
            } else {
                // Existing file, append category
                const entry = fileMap.get(file);
                if (!entry.categories.includes(categorySlug)) {
                    entry.categories.push(categorySlug);
                }
            }
        }
    }

    console.log(`✅ Found ${fileMap.size} unique images to migrate.`);

    // 3. Seed Categories
    console.log("🌱 Seeding Categories...");
    const categoriesBatch = db.batch();
    const categoriesData = [
        { slug: 'all', label: 'All', sort_order: 0 },
        { slug: 'cakes', label: 'Cakes', sort_order: 1 },
        { slug: 'cookies', label: 'Cookies', sort_order: 2 },
        { slug: 'animals', label: 'Animals & Pets', sort_order: 3 },
        { slug: 'holidays', label: 'Holidays & Celebrations', sort_order: 4 },
        { slug: 'kids', label: 'Kids & Characters', sort_order: 5 },
        { slug: 'life', label: 'Life Events', sort_order: 6 },
        { slug: 'school', label: 'School & Sports', sort_order: 7 }
    ];

    for (const cat of categoriesData) {
        const ref = db.collection('gallery_categories').doc(cat.slug);
        categoriesBatch.set(ref, {
            ...cat,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    await categoriesBatch.commit();
    console.log("✅ Categories seeded.");

    // 4. Upload Images & Create Docs
    console.log("⬆️ Uploading images (this may take a while)...");
    let successCount = 0;
    let errorCount = 0;
    const total = fileMap.size;
    let index = 0;

    for (const [filename, data] of fileMap) {
        index++;
        try {
            const destination = `gallery/${filename}`;

            // Upload to Storage
            await bucket.upload(data.originalPath, {
                destination: destination,
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {
                        originalName: filename
                    }
                }
            });

            // Get Public URL (Signed URL for long expiry, or make public)
            // Ideally we make the bucket public via rules (which we did), 
            // so we can construct the URL directly or get a signed one.
            // Let's use getSignedUrl for simplicity in script, but for public access
            // we often use the explicit download token. 
            // Actually, getSignedUrl with very long expiry is standard for "public" read if not purely public bucket.
            // But our rules say "allow read; if true", so we can construct the direct HTTP URL.
            // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media

            const encodedPath = encodeURIComponent(destination);
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

            // Metadata extraction
            const nameWithoutExt = path.parse(filename).name;
            const displayName = nameWithoutExt
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase()); // Title Case

            const tags = nameWithoutExt.split('-').map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');

            // Create Firestore Doc
            await db.collection('gallery_items').add({
                image_url: publicUrl,
                thumb_url: publicUrl, // Initially same as full, updated by Cloud Function later
                storage_path: destination,
                categories: data.categories,
                display_name: displayName,
                tags: tags,
                sort_order: index, // Maintain roughly folder order
                visible: true,
                uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
                uploaded_by: 'system_migration'
            });

            process.stdout.write(`\r✅ Uploaded ${index}/${total}: ${filename}`);
            successCount++;

        } catch (err) {
            console.error(`\n❌ Failed to upload ${filename}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n\n🎉 Migration Complete!`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
