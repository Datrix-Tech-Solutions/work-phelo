import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { HealthController } from '../health/health.controller';

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

@Injectable()
export class FoundationOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (
      context.getClass() === HealthController &&
      req.method === 'GET' &&
      probes.some((probe) => probe.handler === context.getHandler() && probe.path === req.path)
    ) {
      return true;
    }
    throw new ForbiddenException();
  }
}
