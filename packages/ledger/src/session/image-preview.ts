/** Recognize bounded raster structure, not arbitrary files with an image MIME label.
 * The browser still owns decoding and can report unsupported/corrupt pixel data.
 */
export function supportedRaster(bytes: Buffer, mediaType: string): boolean {
  const validSize = (width: number, height: number) => width > 0 && height > 0 && width * height <= 16_000_000
  if (mediaType === "image/png") {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false
    let header = false, pixels = false
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset)
      if (length > bytes.length - offset - 12) return false
      const type = bytes.toString("ascii", offset + 4, offset + 8)
      if (!header) {
        if (type !== "IHDR" || length !== 13 || !validSize(bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12))) return false
        header = true
      } else if (type === "IHDR") return false
      if (type === "IDAT" && length > 0) pixels = true
      if (type === "IEND") return pixels && length === 0
      offset += length + 12
    }
    return false
  }
  if (mediaType !== "image/jpeg" || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return false
  let dimensions = false
  for (let offset = 2; offset < bytes.length;) {
    if (bytes[offset++] !== 255) return false
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === undefined || marker === 0 || marker === 216 || marker === 217) return false
    if (offset + 2 > bytes.length) return false
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) return false
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (length < 8 || !validSize(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))) return false
      dimensions = true
    }
    if (marker === 218) {
      // Require a frame, a full scan header, pixel bytes and an end marker.
      return dimensions && length >= 6 && offset + length < bytes.length - 2 && bytes.at(-2) === 255 && bytes.at(-1) === 217
    }
    offset += length
  }
  return false
}
