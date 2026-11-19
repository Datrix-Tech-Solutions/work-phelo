import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TrustedContextService } from '../auth/trusted-context.service';
import {
  requireConsumedAiRequest,
  VerifiedAiRequest,
} from '../request-integrity/request-integrity.service';

declare const ownershipBrand: unique symbol;
export interface OwnershipContext {
  readonly [ownershipBrand]: true;
}
const contexts = new WeakMap<
  OwnershipContext,
  Readonly<{ tenantId: string; ownerUserId: string }>
>();
const proofs = new WeakMap<OwnershipContext, VerifiedAiRequest>();

export function requireOwnership(context: OwnershipContext) {
  const owner = contexts.get(context);
  if (!owner) throw new UnauthorizedException();
  const proof = proofs.get(context);
  if (proof) requireConsumedAiRequest(proof);
  return owner;
}

export function ownershipDeadline(context: OwnershipContext): number | undefined {
  requireOwnership(context);
  const proof = proofs.get(context);
  return proof ? requireConsumedAiRequest(proof).deadlineAtMs : undefined;
}

@Injectable()
export class OwnershipContextFactory {
  constructor(private readonly authentication: TrustedContextService) {}

  fromConsumedRequest(request: VerifiedAiRequest): OwnershipContext {
    const { tenantId, ownerUserId } = requireConsumedAiRequest(request);
    const context = Object.freeze({}) as OwnershipContext;
    contexts.set(context, Object.freeze({ tenantId, ownerUserId }));
    proofs.set(context, request);
    return context;
  }

  fromRequest(request: Request): OwnershipContext {
    const user = this.authentication.verifyRequest(request);
    if (
      typeof user.id !== 'string' ||
      !user.id.trim() ||
      typeof user.tenantId !== 'string' ||
      !user.tenantId.trim()
    )
      throw new UnauthorizedException();
    const context = Object.freeze({}) as OwnershipContext;
    contexts.set(context, Object.freeze({ tenantId: user.tenantId, ownerUserId: user.id }));
    return context;
  }
}
