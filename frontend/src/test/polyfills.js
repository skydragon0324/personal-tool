// Jest runs on Node 12, which predates APIs the app (and jsdom-facing libraries) rely on, such as
// Array.prototype.at, Object.hasOwn, String.prototype.replaceAll and structuredClone.
require("core-js/stable");

const { TextDecoder, TextEncoder } = require("util");

if (typeof globalThis.TextEncoder === "undefined") globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === "undefined") globalThis.TextDecoder = TextDecoder;
