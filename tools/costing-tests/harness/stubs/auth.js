export function getAuth(){return {currentUser:{email:'test@example.com',uid:'LYJpCo6DEIO9w9Yurupuw0uyxpJ2'}};}
export function onAuthStateChanged(auth,cb){setTimeout(()=>cb(auth.currentUser),0);return ()=>{};}
export function signInWithEmailAndPassword(){} export function signOut(){} export async function sendPasswordResetEmail(){}
