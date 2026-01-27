// Firebase SDK Imports (using module syntax for browser)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Export services and functions for use in other files
export {
    db,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp,
    storage,
    ref,
    uploadBytes,
    getDownloadURL
};
