// Minimal JPEG EXIF reader: when the photo was taken and where.
// Works on the first 256 KB of the file. HEIC/PNG or stripped EXIF → nulls.
// Runs in the browser (before the canvas resize strips EXIF) and on the server.

export type ExifInfo = { takenAt: Date | null; lat: number | null; lng: number | null }

export function readExif(buffer: ArrayBuffer): ExifInfo {
  const none: ExifInfo = { takenAt: null, lat: null, lng: null }
  try {
    const buf = new DataView(buffer)
    if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return none
    let off = 2
    while (off + 4 < buf.byteLength) {
      if (buf.getUint8(off) !== 0xff) break
      const marker = buf.getUint8(off + 1)
      const size = buf.getUint16(off + 2)
      if (marker === 0xe1 && off + 10 < buf.byteLength && buf.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10
        const little = buf.getUint16(tiff) === 0x4949
        const g16 = (o: number) => buf.getUint16(o, little)
        const g32 = (o: number) => buf.getUint32(o, little)
        const readIfd = (ifd: number) => {
          const n = g16(ifd); const m: Record<number, number> = {}
          for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; m[g16(e)] = e }
          return m
        }
        const ifd0 = readIfd(tiff + g32(tiff + 4))
        // Time
        let takenAt: Date | null = null
        let entry: number | undefined
        if (ifd0[0x8769]) entry = readIfd(tiff + g32(ifd0[0x8769] + 8))[0x9003]
        if (!entry) entry = ifd0[0x0132]
        if (entry) {
          const at = tiff + g32(entry + 8)
          let str = ''
          for (let i = 0; i < 19; i++) str += String.fromCharCode(buf.getUint8(at + i))
          const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):?(\d{2})?/)
          if (m) takenAt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0)
        }
        // GPS
        let lat: number | null = null, lng: number | null = null
        if (ifd0[0x8825]) {
          const gps = readIfd(tiff + g32(ifd0[0x8825] + 8))
          const ascii = (e: number) => String.fromCharCode(buf.getUint8(e + 8))
          const dms = (e: number) => {
            const at = tiff + g32(e + 8)
            const r = (i: number) => g32(at + i * 8) / (g32(at + i * 8 + 4) || 1)
            return r(0) + r(1) / 60 + r(2) / 3600
          }
          if (gps[0x0002] && gps[0x0004]) {
            lat = dms(gps[0x0002]) * (gps[0x0001] && ascii(gps[0x0001]) === 'S' ? -1 : 1)
            lng = dms(gps[0x0004]) * (gps[0x0003] && ascii(gps[0x0003]) === 'W' ? -1 : 1)
            if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) { lat = null; lng = null }
          }
        }
        return { takenAt, lat, lng }
      }
      off += 2 + size
    }
  } catch { /* not a parsable JPEG */ }
  return none
}
