(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShiireZip = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[i] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16(output, value) {
    output.push(value & 0xff, (value >>> 8) & 0xff);
  }

  function writeUint32(output, value) {
    output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function bytesFromText(text) {
    return new TextEncoder().encode(text);
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosDateTime(new Date());

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const data = file.bytes;
      const checksum = crc32(data);
      const local = [];
      writeUint32(local, 0x04034b50);
      writeUint16(local, 20);
      writeUint16(local, 0x0800);
      writeUint16(local, 0);
      writeUint16(local, stamp.time);
      writeUint16(local, stamp.date);
      writeUint32(local, checksum);
      writeUint32(local, data.length);
      writeUint32(local, data.length);
      writeUint16(local, nameBytes.length);
      writeUint16(local, 0);
      chunks.push(new Uint8Array(local), nameBytes, data);

      const directory = [];
      writeUint32(directory, 0x02014b50);
      writeUint16(directory, 20);
      writeUint16(directory, 20);
      writeUint16(directory, 0x0800);
      writeUint16(directory, 0);
      writeUint16(directory, stamp.time);
      writeUint16(directory, stamp.date);
      writeUint32(directory, checksum);
      writeUint32(directory, data.length);
      writeUint32(directory, data.length);
      writeUint16(directory, nameBytes.length);
      writeUint16(directory, 0);
      writeUint16(directory, 0);
      writeUint16(directory, 0);
      writeUint16(directory, 0);
      writeUint32(directory, 0);
      writeUint32(directory, offset);
      central.push(new Uint8Array(directory), nameBytes);
      offset += local.length + nameBytes.length + data.length;
    });

    const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = [];
    writeUint32(end, 0x06054b50);
    writeUint16(end, 0);
    writeUint16(end, 0);
    writeUint16(end, files.length);
    writeUint16(end, files.length);
    writeUint32(end, centralSize);
    writeUint32(end, offset);
    writeUint16(end, 0);
    return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/zip" });
  }

  return { bytesFromText, createZip };
});
