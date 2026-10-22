/**
 * iPhone photos (HEIC/HEIF) only display in Safari, so they show as blank boxes in Chrome,
 * Firefox and Edge. Every photo the admin uploads goes through toUploadablePhoto(): a HEIC
 * file comes back as a JPEG (long edge at most MAX_EDGE, no location or other photo data),
 * any other file comes back unchanged. If a conversion fails, the original file comes back.
 *
 * Safari can read HEIC itself. Other browsers load the heic-to converter on first use; it is
 * pinned to one exact file (HEIC_TO_SRI), so the browser refuses it if that file ever changes.
 */

const HEIC_TO_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
const HEIC_TO_SRI = 'sha256-l28jysnUNePD2dh1fDl10fVq6ZVYFGGzqKzmbgfkZA4=';
const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.85;

export function isHeicFile(file) {
    return /^image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
}

export function isHeicUrl(url) {
    return typeof url === 'string' && /\.(heic|heif)$/i.test(url.split('?')[0]);
}

let heicToLoading = null;
function loadHeicTo() {
    if (!heicToLoading) {
        heicToLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = HEIC_TO_URL;
            script.integrity = HEIC_TO_SRI;
            script.crossOrigin = 'anonymous';
            script.onload = () => window.HeicTo ? resolve(window.HeicTo) : reject(new Error('Photo converter did not load'));
            script.onerror = () => reject(new Error('Photo converter could not be downloaded'));
            document.head.appendChild(script);
        }).catch(err => {
            heicToLoading = null; // let the next photo try again
            throw err;
        });
    }
    return heicToLoading;
}

async function decodeHeic(file) {
    try {
        return await createImageBitmap(file); // Safari (Mac, iPhone, iPad)
    } catch (e) {
        const HeicTo = await loadHeicTo();
        const jpeg = await HeicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
        return await createImageBitmap(jpeg);
    }
}

export async function toUploadablePhoto(file) {
    if (!isHeicFile(file)) return file;
    try {
        return await heicToJpeg(file);
    } catch (err) {
        // Never block an upload: fall back to the original file (it still shows in Safari)
        console.warn('Could not convert iPhone photo, uploading the original:', file.name, err);
        return file;
    }
}

async function heicToJpeg(file) {
    const bitmap = await decodeHeic(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not convert the photo to JPEG')), 'image/jpeg', JPEG_QUALITY);
    });
    const name = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
