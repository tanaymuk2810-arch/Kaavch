// Browser port of CertificateEngine.kt: deterministic certNo, hash-chain link,
// and ECDSA P-256 signing/verification using WebCrypto (secure context only —
// localhost qualifies). Produces byte-identical payload/signature formats to the
// Android app so the dashboard verifier validates them.
import { sha256Hex } from "./verify";

export const HASH_CHAIN_DOMAIN = "suraksha-trainer/v1";
export const HASH_GENESIS = "GENESIS-" + "0".repeat(64);

export function buildPayload(
  certNo: string,
  workerId: string,
  moduleId: string,
  score: number,
  issuedAt: number,
  siteName: string,
): string {
  return `${HASH_CHAIN_DOMAIN}|${certNo}|${workerId}|${moduleId}|${score}|${issuedAt}|${siteName}`;
}

interface PendingKey {
  privateKey: CryptoKey;
  publicKeySpkiB64: string;
}

let cachedKey: PendingKey | null = null;

export async function obtainSigningKey(): Promise<PendingKey> {
  if (cachedKey) return cachedKey;
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  cachedKey = {
    privateKey: kp.privateKey,
    publicKeySpkiB64: btoa(String.fromCharCode(...new Uint8Array(spki))),
  };
  return cachedKey;
}

export interface WebCertificate {
  id: string;
  certNo: string;
  workerId: string;
  moduleId: string;
  score: number;
  issuedAt: number;
  siteName: string;
  signedData: string;
  signature: string; // base64 DER (matches Android)
  publicKey: string; // base64 SPKI (matches Android)
  prevHash: string;
  chainHash: string;
  chainVerified: boolean;
  revoked: boolean;
  qrText: string;
}

export function qrTextOf(c: {
  certNo: string; workerId: string; moduleId: string; score: number;
  issuedAt: number; siteName: string; prevHash: string; chainHash: string;
  publicKey: string; signature: string;
}): string {
  return buildPayload(c.certNo, c.workerId, c.moduleId, c.score, c.issuedAt, c.siteName)
    + `|${c.prevHash}|${c.chainHash}|${c.publicKey}|${c.signature}`;
}

function rawToDer(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) throw new Error("expected 64-byte raw signature");
  const strip = (b: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    return b.slice(i);
  };
  const encInt = (v: Uint8Array): Uint8Array => {
    const t = strip(v);
    const pad = t[0] & 0x80 ? 1 : 0;
    const out = new Uint8Array(2 + t.length + pad);
    out[0] = 0x02;
    out[1] = t.length + pad;
    if (pad) out[2] = 0;
    out.set(t, 2 + pad);
    return out;
  };
  const r = encInt(raw.slice(0, 32));
  const s = encInt(raw.slice(32));
  const out = new Uint8Array(2 + r.length + s.length);
  out[0] = 0x30;
  out[1] = r.length + s.length;
  out.set(r, 2);
  out.set(s, 2 + r.length);
  return out;
}

// subtle.sign returns raw r||s in Chrome/Node but DER elsewhere — normalize
// to DER so QR payloads stay byte-identical to the Android app.
function toDerSignature(sig: Uint8Array): Uint8Array {
  if (sig.length !== 64) return sig; // already DER
  return rawToDer(sig);
}

export async function generateCertificate(
  workerId: string,
  moduleId: string,
  score: number,
  siteName: string,
  prevChainHash = HASH_GENESIS,
): Promise<WebCertificate> {
  const id = crypto.randomUUID();
  const issuedAt = Date.now();
  // Deterministic certNo (same algorithm as Android).
  const provisional = buildPayload("", workerId, moduleId, score, issuedAt, siteName);
  const payloadHash = (await sha256Hex(provisional)).toUpperCase().slice(0, 12);
  const certNo =
    "KVK-" + workerId.slice(0, 4).toUpperCase() + "-" +
    payloadHash.match(/.{1,4}/g)!.join("-");
  const payload = buildPayload(certNo, workerId, moduleId, score, issuedAt, siteName);
  const chainHash = await sha256Hex(`${prevChainHash}|${payload}`);

  const key = await obtainSigningKey();
  const rawSig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key.privateKey,
      new TextEncoder().encode(payload).buffer,
    ),
  );
  const signature = btoa(String.fromCharCode(...toDerSignature(rawSig)));

  const cert: WebCertificate = {
    id,
    certNo,
    workerId,
    moduleId,
    score,
    issuedAt,
    siteName,
    signedData: payload,
    signature,
    publicKey: key.publicKeySpkiB64,
    prevHash: prevChainHash,
    chainHash,
    chainVerified: false,
    revoked: false,
    qrText: "",
  };
  cert.qrText = qrTextOf(cert);
  return cert;
}