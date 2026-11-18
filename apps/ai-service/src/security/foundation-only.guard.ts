import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { HealthController } from '../health/health.controller';
import { EligibilityController } from '../eligibility/eligibility.controller';
import { TrustedAuthGuard } from '../auth/trusted-auth.guard';

// Handler identity is checked as well as the exact verb/path. No reusable Public decorator.
const probes = Object.freeze([
  Object.freeze({
    handler: Object.getOwnPropertyDescriptor(HealthController.prototype, 'health')
      ?.value as unknown,
    path: '/api/health',
  }),
  Object.freeze({
    handler: Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready')?.value as unknown,
    path: '/api/ready',
  }),
]);
const eligibilityHandler = Object.getOwnPropertyDescriptor(
  EligibilityController.prototype,
  'eligibility',
)?.value as unknown;

@Injectable()
export class FoundationOnlyGuard implements CanActivate {
  constructor(private readonly authentication: TrustedAuthGuard) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (
      context.getClass() === HealthController &&
      req.method === 'GET' &&
      probes.some((probe) => probe.handler === context.getHandler() && probe.path === req.path)
    ) {
      return true;
    }
    if (
      context.getClass() === EligibilityController &&
      context.getHandler() === eligibilityHandler &&
      req.method === 'GET' &&
      req.path === '/api/eligibility'
    ) {
      context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
      return this.authentication.canActivate(context);
    }
    throw new ForbiddenException();
  }
}
