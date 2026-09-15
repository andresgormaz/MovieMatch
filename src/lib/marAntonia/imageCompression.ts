// This app has no external file storage set up (no S3/Vercel Blob/etc), so a
// photo attached to a doctor/prescription/product row is stored directly in
// that row as a compressed JPEG data: URL -- fine for the low volume a
// single family's records amount to, but only if kept small. Compressing
// client-side (resize + JPEG re-encode via canvas) before it ever reaches
// the network keeps typical phone-camera photos (often several MB) down to
// well under this cap.
export const MAX_PHOTO_DATA_URL_LENGTH = 2_000_000; // ~1.5MB of binary image data

export function compressImageFile(file: File, maxDim = 1000, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
