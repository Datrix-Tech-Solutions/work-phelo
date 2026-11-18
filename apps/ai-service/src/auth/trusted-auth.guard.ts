import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { TrustedAiIdentity, TrustedContextService } from './trusted-context.service';

export type TrustedAiRequest = Request & { user?: TrustedAiIdentity };

@Injectable()
export class TrustedAuthGuard implements CanActivate {
  constructor(private readonly contexts: TrustedContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TrustedAiRequest>();
    delete request.user;
    request.user = this.contexts.verifyRequest(request);
    return true;
  }
}
