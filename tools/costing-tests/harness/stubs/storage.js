// Minimal Storage stub: uploads are remembered in memory, download URLs are tiny data URLs.
const files = new Map();
export function getStorage(){ return {}; }
export function ref(storage, path){ return { path }; }
export async function uploadBytes(r, file, meta){ files.set(r.path, { size: file.size, type: meta?.contentType || file.type }); window.__uploads = (window.__uploads||[]).concat([r.path]); return { ref: r }; }
export async function getDownloadURL(r){ return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#ddd"/><text x="6" y="32" font-size="10">' + r.path.slice(-8) + '</text></svg>'); }
export async function deleteObject(r){ files.delete(r.path); }
