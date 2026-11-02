// Node 12.16 compatibility for the Next.js server. Loaded from next.config.js.
//
// Next 12 streams rendered pages to the response as Uint8Array chunks, but on Node 12.16
// `res.write()` / `res.end()` only accept strings and Buffers. Wrap plain Uint8Arrays in a Buffer
// (no copy) so server-rendered pages work.
const { OutgoingMessage } = require("http");

function toBuffer(chunk) {
  return chunk instanceof Uint8Array && !Buffer.isBuffer(chunk)
    ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    : chunk;
}

if (!OutgoingMessage.prototype.__node12CompatPatched) {
  for (const method of ["write", "end"]) {
    const original = OutgoingMessage.prototype[method];
    OutgoingMessage.prototype[method] = function patched(chunk, ...rest) {
      return original.call(this, toBuffer(chunk), ...rest);
    };
  }
  OutgoingMessage.prototype.__node12CompatPatched = true;
}
