import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '@work-phelo/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      // Extract JWT from cookie first, fall back to Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  private async resolveEffectivePermissions(
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<string[]> {
    if (role !== 'EMPLOYEE') return [];

    const [allDirectPerms, setAssignments] = await Promise.all([
      this.prisma.userPermission.findMany({
        where: { tenantId, userId },
        include: { resource: true },
      }),
      this.prisma.userPermissionSet.findMany({
        where: { userId },
        include: {
          permissionSet: {
            include: { resources: { include: { resource: true } } },
          },
        },
      }),
    ]);

    const direct = allDirectPerms
      .filter((p) => p.isActive && (!p.expiresAt || p.expiresAt > new Date()))
      .map((p) => `${p.resource.name}:${p.action}`);

    const fromSets = setAssignments.flatMap((a) =>
      a.permissionSet.resources.map((r) => `${r.resource.name}:${r.action}`),
    );

    // Revoked direct permissions remain as audit history, but they do not act
    // as hard denies against permissions granted via roles or permission sets.
    return [...new Set([...direct, ...fromSets])];
  }

  async validate(payload: any): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true, companyRole: { select: { name: true } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const permissions = await this.resolveEffectivePermissions(
      user.id,
      user.tenantId,
      user.role,
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantName: user.tenant.name,
      firstName: user.firstName,
      companyRoleId: user.companyRoleId ?? null,
      companyRoleName: user.companyRole?.name ?? null,
      moduleConfig: (user.tenant.moduleConfig as Record<string, boolean>) ?? {},
      featureConfig:
        (user.tenant.featureConfig as Record<
          string,
          Record<string, boolean>
        >) ?? {},
      permissions,
    };
  }
}
