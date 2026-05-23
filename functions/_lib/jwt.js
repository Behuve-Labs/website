// Tiny HS256 JWT helper built on WebCrypto. No dependencies — Workers can't
// pull `jsonwebtoken` (Node-only). Format: header.payload.signature, each
// segment base64url-encoded.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload, secret) {
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64urlEncode(sig)}`;
}

// Returns the payload object on success, throws on any failure (bad shape,
// bad signature, expired). Callers should treat any throw as "logged out".
export async function verifyJwt(token, secret) {
  if (typeof token !== 'string') throw new Error('not a token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad shape');
  const [headerB64, bodyB64, sigB64] = parts;
  const key = await getKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecodeToBytes(sigB64),
    enc.encode(`${headerB64}.${bodyB64}`)
  );
  if (!valid) throw new Error('bad signature');
  const payload = JSON.parse(dec.decode(b64urlDecodeToBytes(bodyB64)));
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
    throw new Error('expired');
  }
  return payload;
}
