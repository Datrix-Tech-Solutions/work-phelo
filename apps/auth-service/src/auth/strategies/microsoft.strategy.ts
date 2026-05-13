import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('MICROSOFT_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('MICROSOFT_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('MICROSOFT_CALLBACK_URL'),
      scope: ['user.read'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    const tenantSlug = req.query.state || req.query.tenantSlug;

    // Normalize Microsoft profile to match Google profile shape
    const normalizedProfile = {
      id: profile.id,
      emails: [
        {
          value:
            profile.emails?.[0]?.value ||
            profile._json?.mail ||
            profile._json?.userPrincipalName,
        },
      ],
      displayName: profile.displayName,
    };

    done(null, { profile: normalizedProfile, tenantSlug });
  }
}
