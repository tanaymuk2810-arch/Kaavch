// Locally-run certificate verifier. Mirrors android CertificateEngine: parses
// the QR payload, recomputes the hash-chain link, checks the ECDSA signature
// and revocation status — all in the browser, no server.
export const HASH_CHAIN_DOMAIN = "suraksha-trainer/v1";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// domain | certNo | workerId | moduleId | score | issuedAt | siteName
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

export interface ParsedQr {
  certNo: string;
  workerId: string;
  moduleId: string;
  score: number;
  issuedAt: number;
  siteName: string;
  prevHash: string;
  chainHash: string;
  publicKey: string;
  signature: string;
}

export function parseQr(qrText: string): ParsedQr | null {
  const parts = qrText.split("|");
  if (parts.length !== 11 || parts[0] !== HASH_CHAIN_DOMAIN) return null;
  const score = Number(parts[4]);
  const issuedAt = Number(parts[5]);
  if (Number.isNaN(score) || Number.isNaN(issuedAt)) return null;
  return {
    certNo: parts[1],
    workerId: parts[2],
    moduleId: parts[3],
    score,
    issuedAt,
    siteName: parts[6],
    prevHash: parts[7],
    chainHash: parts[8],
    publicKey: parts[9],
    signature: parts[10],
  };
}

function stripPad(bytes: Uint8Array, target: number): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  const trimmed = bytes.slice(start);
  if (trimmed.length > target) throw new Error("int too long");
  const out = new Uint8Array(target);
  out.set(trimmed, target - trimmed.length);
  return out;
}

export function derToRaw(der: Uint8Array): Uint8Array {
  let pos = 0;
  if (der[pos++] !== 0x30) throw new Error("not a DER sequence");
  const seqLen = der[pos++];
  if (der[pos++] !== 0x02) throw new Error("expected integer");
  const rLen = der[pos++];
  const r = stripPad(der.slice(pos, pos + rLen), 32);
  pos += rLen;
  if (der[pos++] !== 0x02) throw new Error("expected integer");
  const sLen = der[pos++];
  const s = stripPad(der.slice(pos, pos + sLen), 32);
  void seqLen;
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export async function verifySignature(
  publicKeyB64: string,
  payload: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const spki = Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "spki",
      spki.buffer as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode(payload).buffer as ArrayBuffer;
    const alg = { name: "ECDSA", hash: "SHA-256" };
    const attempt = async (raw: Uint8Array): Promise<boolean> => {
      try {
        return await crypto.subtle.verify(alg, key, raw.buffer as ArrayBuffer, data);
      } catch {
        return false;
      }
    };
    // 64 bytes ⇒ raw r||s (Chrome/Node issuance, min DER is 70 bytes).
    // Anything else ⇒ DER (Android issuance) → convert first.
    if (sig.length === 64) {
      if (await attempt(sig)) return true;
    }
    try {
      if (await attempt(derToRaw(sig))) return true;
    } catch {
      /* not DER either */
    }
    return false;
  } catch {
    return false;
  }
}

export interface LegacyCert {
  id: string;
  certNo: string;
  workerId: string;
  moduleId: string;
  score: number;
  issuedAt: number;
  siteName: string;
  prevHash: string;
  chainHash: string;
  revoked?: boolean;
}

export interface VerifyResult {
  valid: boolean;
  reason: string;
  chainOk: boolean;
  signatureOk: boolean;
  revoked: boolean;
  certificate?: LegacyCert | null;
}

export async function verifyCertLocal(qrText: string, certs: LegacyCert[]): Promise<VerifyResult> {
  const parsed = parseQr(qrText.trim());
  if (!parsed) return { valid: false, reason: "not-suraksha-format", chainOk: false, signatureOk: false, revoked: false };
  const canonical = buildPayload(parsed.certNo, parsed.workerId, parsed.moduleId, parsed.score, parsed.issuedAt, parsed.siteName);
  const recomputed = await sha256Hex(`${parsed.prevHash}|${canonical}`);
  const chainOk = recomputed === parsed.chainHash;
  const signatureOk = await verifySignature(parsed.publicKey, canonical, parsed.signature);
  const ledger = certs.find((c) => c.certNo === parsed.certNo);
  const ledgerOk = !ledger || ledger.chainHash === parsed.chainHash;
  const revoked = ledger?.revoked === true || false;
  const valid = chainOk && signatureOk && ledgerOk && !revoked;
  return {
    valid,
    reason: !chainOk || !ledgerOk ? "chain-mismatch"
      : !signatureOk ? "signature-invalid"
      : revoked ? "revoked" : "ok",
    chainOk: chainOk && ledgerOk,
    signatureOk,
    revoked,
    certificate: ledger ?? null,
  };
}