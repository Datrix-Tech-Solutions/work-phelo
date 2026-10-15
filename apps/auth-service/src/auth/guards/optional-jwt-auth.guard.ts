import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequestUser } from '@work-phelo/types';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = RequestUser>(
    _error: unknown,
    user: RequestUser | false | null,
  ): TUser {
    // Registration is public, but a valid platform-admin session keeps the
    // established managed-tenant flow distinct from self-registration.
    return (user || null) as TUser;
  }
}
