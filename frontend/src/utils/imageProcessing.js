// Client-side image resize/compress via the Canvas API — no library needed
// (browser-image-compression et al. all do this same draw-to-canvas-then-
// re-encode trick internally). Cuts a typical 8-15MB phone photo down to a
// few hundred KB before it ever reaches Cloudinary, which is most of what
// storage optimization actually is: fewer bytes in, not just cleanup on the way out.

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function canvasToFile(canvas, file, quality) {
    return new Promise((resolve) => {
        canvas.toBlob(
            (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
            'image/jpeg',
            quality
        );
    });
}

/**
 * Downscale + re-encode an image, preserving aspect ratio. Skips non-image
 * files (e.g. video) untouched.
 */
export async function compressImage(file, { maxWidthOrHeight = 1280, quality = 0.8 } = {}) {
    if (!file || !file.type?.startsWith('image/')) return file;

    const img = await loadImage(file);
    const scale = Math.min(1, maxWidthOrHeight / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);

    const compressed = await canvasToFile(canvas, file, quality);
    // Don't ship a "compressed" file that's bigger than the original (can
    // happen with already-small or already-heavily-compressed sources).
    return compressed.size < file.size ? compressed : file;
}

/**
 * Resize AND crop (cover-fit, centered) to an exact target size — for
 * anything that must land at a specific aspect ratio (profile cover banner),
 * regardless of what shape the source photo happens to be.
 */
export async function resizeToExactSize(file, { width, height, quality = 0.85 } = {}) {
    if (!file || !file.type?.startsWith('image/')) return file;

    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const targetRatio = width / height;
    const sourceRatio = img.width / img.height;
    let sx, sy, sw, sh;
    if (sourceRatio > targetRatio) {
        // Source is wider than target — crop the sides.
        sh = img.height;
        sw = sh * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        // Source is taller than target — crop top/bottom.
        sw = img.width;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    URL.revokeObjectURL(img.src);

    return canvasToFile(canvas, file, quality);
}
