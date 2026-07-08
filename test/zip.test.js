const assert = require("node:assert/strict");
const test = require("node:test");
const { bytesFromText, createZip } = require("../src/zip");

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function parseStoredZip(bytes) {
  const decoder = new TextDecoder();
  const files = [];
  let offset = 0;

  while (readUint32(bytes, offset) === 0x04034b50) {
    const flags = readUint16(bytes, offset + 6);
    const method = readUint16(bytes, offset + 8);
    const size = readUint32(bytes, offset + 18);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const data = bytes.slice(dataStart, dataStart + size);

    files.push({ name, data, flags, method });
    offset = dataStart + size;
  }

  return files;
}

test("ZIPは日本語ファイル名と証憑フォルダをUTF-8で格納する", async () => {
  const blob = createZip([
    {
      name: "税理士提出_2026-07/01_仕入一覧.csv",
      bytes: bytesFromText("仕入日,商品名\r\n2026-07-01,Canon PowerShot")
    },
    {
      name: "税理士提出_2026-07/証憑/001_2026-07-01_CanonPowerShot_38000_明細.jpg",
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    }
  ]);

  assert.equal(blob.type, "application/zip");
  const bytes = await blobToBytes(blob);
  assert.equal(readUint32(bytes, 0), 0x04034b50);
  assert.equal(readUint32(bytes, bytes.length - 22), 0x06054b50);

  const files = parseStoredZip(bytes);
  assert.deepEqual(files.map((file) => file.name), [
    "税理士提出_2026-07/01_仕入一覧.csv",
    "税理士提出_2026-07/証憑/001_2026-07-01_CanonPowerShot_38000_明細.jpg"
  ]);
  assert.ok(files.every((file) => file.flags & 0x0800));
  assert.ok(files.every((file) => file.method === 0));
  assert.equal(new TextDecoder().decode(files[0].data), "仕入日,商品名\r\n2026-07-01,Canon PowerShot");
  assert.deepEqual(Array.from(files[1].data), [0xff, 0xd8, 0xff, 0xd9]);
});
