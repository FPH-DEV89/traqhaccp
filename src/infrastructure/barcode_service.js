/**
 * TraqHACCP Pro - Infrastructure Layer: Barcode & QR Generator
 * Clean Architecture - Pure SVG Vector Generator for Thermal Labels
 */

export class BarcodeService {
  /**
   * Generates a high-contrast Code 128 style SVG barcode from a string
   */
  static generateBarcodeSVG(text, height = 36) {
    const cleanText = (text || 'LOT-2026-000').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    let barsHtml = '';
    let x = 4;
    
    // Pseudo-code 128 pattern based on character hash
    const startPattern = [2, 1, 1, 2, 3, 2];
    startPattern.forEach((w, i) => {
      if (i % 2 === 0) {
        barsHtml += `<rect x="${x}" y="0" width="${w * 1.5}" height="${height}" fill="#000000" />`;
      }
      x += w * 1.5;
    });

    for (let c = 0; c < cleanText.length; c++) {
      const code = cleanText.charCodeAt(c);
      const w1 = (code % 3) + 1;
      const w2 = ((code >> 1) % 2) + 1;
      const w3 = ((code >> 2) % 3) + 1;
      const space = ((code >> 3) % 2) + 1;

      barsHtml += `<rect x="${x}" y="0" width="${w1 * 1.4}" height="${height}" fill="#000000" />`;
      x += (w1 * 1.4) + (space * 1.2);
      barsHtml += `<rect x="${x}" y="0" width="${w2 * 1.4}" height="${height}" fill="#000000" />`;
      x += (w2 * 1.4) + (space * 1.2);
      barsHtml += `<rect x="${x}" y="0" width="${w3 * 1.4}" height="${height}" fill="#000000" />`;
      x += (w3 * 1.4) + (space * 1.2);
    }

    const endPattern = [2, 3, 3, 1, 1, 1, 2];
    endPattern.forEach((w, i) => {
      if (i % 2 === 0) {
        barsHtml += `<rect x="${x}" y="0" width="${w * 1.5}" height="${height}" fill="#000000" />`;
      }
      x += w * 1.5;
    });

    const totalWidth = x + 4;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" class="w-full h-8 max-w-[200px]" preserveAspectRatio="none">
        ${barsHtml}
      </svg>
    `;
  }

  /**
   * Generates a 2D QR-matrix badge in pure SVG
   */
  static generateQrBadgeSVG(text, size = 48) {
    const hash = (text || 'HACCP').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gridSize = 11;
    const cellSize = size / gridSize;
    let rects = '';

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Corner markers (standard QR look)
        const isCorner = 
          (row < 3 && col < 3) || 
          (row < 3 && col >= gridSize - 3) || 
          (row >= gridSize - 3 && col < 3);

        const isFilled = isCorner || ((hash * (row + 1) * (col + 1)) % 7 > 2);
        if (isFilled) {
          rects += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000" />`;
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="border border-slate-300 p-0.5 bg-white rounded">
        ${rects}
      </svg>
    `;
  }
}
