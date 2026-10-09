import type { AnalyzeDoc } from './ai-schema'

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

export const stripDataUrl = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

/** Downscales an image so its longest side is ≤ maxSide, returned as a JPEG data URL. */
export async function downscaleImage(file: Blob, maxSide = 1600, quality = 0.86): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const isDocx = (f: File) => /\.docx$/i.test(f.name) || f.type.includes('wordprocessingml')

/** Turns any supported circuit-list file into something we can parse locally or send to the model. */
export async function fileToDoc(file: File): Promise<AnalyzeDoc> {
  if (isImage(file)) {
    return { kind: 'image', name: file.name, media_type: 'image/jpeg', data: stripDataUrl(await downscaleImage(file, 2000)) }
  }
  if (isPdf(file)) {
    return { kind: 'pdf', name: file.name, data: stripDataUrl(await readAsDataUrl(file)) }
  }
  if (isDocx(file)) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return { kind: 'text', name: file.name, text: value }
  }
  return { kind: 'text', name: file.name, text: await file.text() }
}

export function download(filename: string, data: Blob | string, type = 'application/json') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
