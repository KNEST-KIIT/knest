import jsQR from 'jsqr'
import qrcode from 'qrcode-generator'

/**
 * QR drawing and decoding. Drawing uses `qrcode-generator` (MIT, no dependencies); decoding uses
 * `jsqr` (Apache-2.0, pure JavaScript, no WebAssembly so the page needs no `wasm-unsafe-eval`).
 * Where the browser has a native `BarcodeDetector` the scanner prefers it; jsQR is the fallback and
 * the only decoder on iOS Safari and Firefox.
 */

export type QrMatrix = { size: number; dark: (row: number, col: number) => boolean }

/** Error correction M: tolerant of a scuffed or dim screen, still a small symbol for a 250 character token. */
export function encodeQr(text: string): QrMatrix {
  const qr = qrcode(0, 'M')
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  return { size, dark: (row, col) => qr.isDark(row, col) }
}

/** An SVG path (`M x y h1 v1 h-1z` per dark module, merged by row run) with a four-module quiet zone. */
export function qrPath(matrix: QrMatrix, quiet = 4): { path: string; viewBox: string } {
  let path = ''
  for (let r = 0; r < matrix.size; r++) {
    let c = 0
    while (c < matrix.size) {
      if (!matrix.dark(r, c)) {
        c++
        continue
      }
      const start = c
      while (c < matrix.size && matrix.dark(r, c)) c++
      path += `M${start + quiet} ${r + quiet}h${c - start}v1h-${c - start}z`
    }
  }
  const total = matrix.size + quiet * 2
  return { path, viewBox: `0 0 ${total} ${total}` }
}

/** RGBA pixels for a matrix, used by tests and as a canvas fallback. */
export function rasterize(matrix: QrMatrix, scale = 4, quiet = 4): { data: Uint8ClampedArray; width: number; height: number } {
  const side = (matrix.size + quiet * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.dark(r, c)) continue
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = ((r + quiet) * scale + y) * side + (c + quiet) * scale + x
          data[px * 4] = data[px * 4 + 1] = data[px * 4 + 2] = 0
        }
      }
    }
  }
  return { data, width: side, height: side }
}

/** Decodes one RGBA frame. Returns the text or null. */
export function decodeFrame(data: Uint8ClampedArray, width: number, height: number): string | null {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  return result?.data ?? null
}
