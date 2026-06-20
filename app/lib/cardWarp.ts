type Pt = { x: number; y: number }

// Perspective-warp the 4-corner card quad (corners as % of image, order TL,TR,BR,BL)
// into a clean upright card rectangle. Pure JS (Heckbert square->quad). Falls back to the original file on any error.
export async function warpCardToFile(file: File, cornersPct: Pt[], outW = 1000): Promise<File> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.onload = () => {
        try {
          const maxSrc = 2000
          const s = Math.min(1, maxSrc / Math.max(img.naturalWidth, img.naturalHeight))
          const srcW = Math.round(img.naturalWidth * s)
          const srcH = Math.round(img.naturalHeight * s)
          const src = document.createElement('canvas')
          src.width = srcW; src.height = srcH
          const sctx = src.getContext('2d')!
          sctx.drawImage(img, 0, 0, srcW, srcH)

          let q = cornersPct.map((c) => ({ x: (c.x / 100) * srcW, y: (c.y / 100) * srcH }))
          const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4
          const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4
          const k = 1.02
          q = q.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }))

          const outH = Math.round(outW / 1.585)
          const [p0, p1, p2, p3] = q
          const x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y
          const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
          const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
          const det = dx1 * dy2 - dx2 * dy1
          let g = 0, h = 0
          if (!(Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) && Math.abs(det) > 1e-9) {
            g = (dx3 * dy2 - dx2 * dy3) / det
            h = (dx1 * dy3 - dx3 * dy1) / det
          }
          const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0
          const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0

          const srcData = sctx.getImageData(0, 0, srcW, srcH).data
          const out = document.createElement('canvas')
          out.width = outW; out.height = outH
          const octx = out.getContext('2d')!
          const outImg = octx.createImageData(outW, outH)
          const o = outImg.data
          const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
          for (let py = 0; py < outH; py++) {
            const V = outH > 1 ? py / (outH - 1) : 0
            for (let px = 0; px < outW; px++) {
              const U = outW > 1 ? px / (outW - 1) : 0
              const denom = g * U + h * V + 1
              const sx = (a * U + b * V + c) / denom
              const sy = (d * U + e * V + f) / denom
              const ix = Math.floor(sx), iy = Math.floor(sy)
              const fx = sx - ix, fy = sy - iy
              const xa = clamp(ix, 0, srcW - 1), xb = clamp(ix + 1, 0, srcW - 1)
              const ya = clamp(iy, 0, srcH - 1), yb = clamp(iy + 1, 0, srcH - 1)
              const i00 = (ya * srcW + xa) * 4, i10 = (ya * srcW + xb) * 4, i01 = (yb * srcW + xa) * 4, i11 = (yb * srcW + xb) * 4
              const oi = (py * outW + px) * 4
              for (let ch = 0; ch < 4; ch++) {
                const top = srcData[i00 + ch] * (1 - fx) + srcData[i10 + ch] * fx
                const bot = srcData[i01 + ch] * (1 - fx) + srcData[i11 + ch] * fx
                o[oi + ch] = top * (1 - fy) + bot * fy
              }
            }
          }
          octx.putImageData(outImg, 0, 0)
          URL.revokeObjectURL(url)
          out.toBlob((blob) => {
            resolve(blob ? new File([blob], 'cscs-card.jpg', { type: 'image/jpeg' }) : file)
          }, 'image/jpeg', 0.92)
        } catch {
          URL.revokeObjectURL(url)
          resolve(file)
        }
      }
      img.src = url
    } catch {
      resolve(file)
    }
  })
}
