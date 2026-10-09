import { embeddedFontCss } from './fonts'

/**
 * Rasterises the rendered sheet SVGs at `dpi` and writes them into a PDF with exact
 * physical page size, so "Actual size / 100%" printing gives true millimetres.
 */
export async function sheetsToPdf(svgs: SVGSVGElement[], widthMm: number, heightMm: number, families: string[], dpi = 450): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const fontCss = await embeddedFontCss(families)
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: widthMm > heightMm ? 'landscape' : 'portrait', compress: true })
  const pxW = Math.round((widthMm / 25.4) * dpi)
  const pxH = Math.round((heightMm / 25.4) * dpi)

  for (const [i, svg] of svgs.entries()) {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(pxW))
    clone.setAttribute('height', String(pxH))
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = fontCss
    clone.insertBefore(style, clone.firstChild)
    const markup = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      // Give embedded fonts a moment to be applied inside the SVG image (Safari).
      await new Promise(r => setTimeout(r, 60))
      const canvas = document.createElement('canvas')
      canvas.width = pxW
      canvas.height = pxH
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, pxW, pxH)
      ctx.drawImage(img, 0, 0, pxW, pxH)
      if (i > 0) pdf.addPage([widthMm, heightMm], widthMm > heightMm ? 'landscape' : 'portrait')
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return pdf.output('blob')
}
