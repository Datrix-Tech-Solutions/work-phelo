import { createHash } from 'crypto';
import { canonicalJson, computeRequestSignature, isUsableSecret, signaturesMatch } from './signing';

export interface EmployeeAccessProof {
  service: 'hr-service' | 'auth-service';
  timestamp: string;
  signature: string;
}

export const accessFingerprint = (payload: unknown): string =>
  createHash('sha256').update(canonicalJson(payload)).digest('hex');

export function signAccessRpc<T extends object>(
  service: EmployeeAccessProof['service'],
  pattern: string,
  payload: T,
) {
  const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
  if (!isUsableSecret(secret))
    throw new Error('Employee access internal authentication is not configured');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    payload,
    proof: {
      service,
      timestamp,
      signature: computeRequestSignature(secret, {
        serviceName: service,
        timestamp,
        method: 'RPC',
        path: pattern,
        query: [],
        body: payload,
      }),
    },
  };
}

export function verifyAccessRpc<T extends object>(
  service: EmployeeAccessProof['service'],
  pattern: string,
  envelope: { payload: T; proof: EmployeeAccessProof },
): T {
  const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
  const proof = envelope?.proof;
  if (
    !isUsableSecret(secret) ||
    !proof ||
    proof.service !== service ||
    !/^\d+$/.test(proof.timestamp) ||
    Math.abs(Date.now() / 1000 - Number(proof.timestamp)) > 60 ||
    typeof proof.signature !== 'string' ||
    !signaturesMatch(
      computeRequestSignature(secret, {
        serviceName: service,
        timestamp: proof.timestamp,
        method: 'RPC',
        path: pattern,
        query: [],
        body: envelope.payload,
      }),
      proof.signature,
    )
  )
    throw new Error('Invalid employee access service context');
  return envelope.payload;
}
