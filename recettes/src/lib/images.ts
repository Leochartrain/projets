/** Côté le plus long d'une photo envoyée : assez pour un écran de téléphone, léger pour l'offre gratuite. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Réduit une photo avant l'envoi (une photo de téléphone de 4 Mo devient ~200 Ko)
 * et la convertit en WebP. Retourne le fichier d'origine si le navigateur ne sait pas faire.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
  } catch {
    return file;
  }
}
