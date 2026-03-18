import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDJN2zEpskErd1Q1w0GKR_EXmV0lIh9Ghk",
    authDomain: "bakedbybostik-5eb55.firebaseapp.com",
    projectId: "bakedbybostik-5eb55",
    storageBucket: "bakedbybostik-5eb55.firebasestorage.app",
    messagingSenderId: "824666210371",
    appId: "1:824666210371:web:aff62bab948c5f91ec54f6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    try {
        console.log("Fetching reviews...");
        const snaps = await getDocs(collection(db, "reviews"));
        console.log("Reviews count:", snaps.size);
        snaps.forEach(doc => console.log(doc.id, "=>", doc.data()));
    } catch(e) {
        console.error("Error:", e);
    }
}
check();
