/* eslint-disable @typescript-eslint/unbound-method -- Route methods are reflection targets, not unbound calls. */
import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';
import { Permission } from '@work-phelo/config';
import { AssetsController } from '../../assets/assets.controller';
import { AppraisalsController } from '../../appraisals/appraisals.controller';
import { PermissionsGuard } from './permissions.guard';
import {
  PERMISSIONS_KEY,
  PERMISSION_EXEMPT_KEY,
  PermissionExempt,
  RequirePermissions,
} from '../decorators/permissions.decorator';

function context(
  handler: ReturnType<ExecutionContext['getHandler']>,
  controller: ReturnType<ExecutionContext['getClass']>,
  permissions: string[] = [],
  role = 'EMPLOYEE',
  authenticated = true,
) {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({
        user: authenticated
          ? { id: 'user', tenantId: 'tenant', role, permissions }
          : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('Explicit HTTP permission declarations (hr-service)', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  // Normalize sync/async guards without changing their runtime signatures.
  const check = (ctx: ExecutionContext) =>
    Promise.resolve().then(() => guard.canActivate(ctx));
  const allow = Permission.READ_EMPLOYEES;

  it('allows an explicitly permissioned employee', async () => {
    class Controller {
      @RequirePermissions(allow) route() {}
    }
    await expect(
      check(
        context(Controller.prototype.route, Controller, ['employees:VIEW']),
      ),
    ).resolves.toBe(true);
  });
  it('denies a missing required permission', async () => {
    class Controller {
      @RequirePermissions(allow) route() {}
    }
    await expect(
      check(context(Controller.prototype.route, Controller)),
    ).rejects.toThrow(ForbiddenException);
  });
  it.each(['EMPLOYEE', 'TENANT_ADMIN', 'SUPER_ADMIN'])(
    'denies an undeclared route for %s',
    async (role) => {
      class Controller {
        route() {}
      }
      await expect(
        check(context(Controller.prototype.route, Controller, [], role)),
      ).rejects.toThrow(ForbiddenException);
    },
  );
  it.each(['TENANT_ADMIN', 'SUPER_ADMIN'])(
    'preserves granular bypass on a declared route for %s',
    async (role) => {
      class Controller {
        @RequirePermissions(allow) route() {}
      }
      await expect(
        check(context(Controller.prototype.route, Controller, [], role)),
      ).resolves.toBe(true);
    },
  );
  it.each(['self-service', 'module-reference', 'service-policy'] as const)(
    'accepts an explicit %s policy only with an authenticated user',
    async (policy) => {
      class Controller {
        @PermissionExempt(policy, 'Reviewed test policy') route() {}
      }
      await expect(
        check(context(Controller.prototype.route, Controller)),
      ).resolves.toBe(true);
      await expect(
        check(
          context(
            Controller.prototype.route,
            Controller,
            [],
            'EMPLOYEE',
            false,
          ),
        ),
      ).rejects.toThrow(ForbiddenException);
    },
  );
  it('rejects empty permissions, malformed policies and blank reasons even for admins', async () => {
    class Controller {
      route() {}
    }
    const ctx = context(
      Controller.prototype.route,
      Controller,
      [],
      'TENANT_ADMIN',
    );
    Reflect.defineMetadata(PERMISSIONS_KEY, [], Controller.prototype.route);
    await expect(check(ctx)).rejects.toThrow(ForbiddenException);
    Reflect.defineMetadata(
      PERMISSION_EXEMPT_KEY,
      { policy: 'public', reason: 'invalid' },
      Controller.prototype.route,
    );
    await expect(check(ctx)).rejects.toThrow(ForbiddenException);
    Reflect.defineMetadata(
      PERMISSION_EXEMPT_KEY,
      { policy: 'self-service', reason: ' ' },
      Controller.prototype.route,
    );
    await expect(check(ctx)).rejects.toThrow(ForbiddenException);
  });
  it('inherits class permissions and enforces method overrides', async () => {
    @RequirePermissions(allow)
    class Controller {
      inherited() {}
      @RequirePermissions(Permission.CREATE_EMPLOYEE) override() {}
      @PermissionExempt('self-service', 'Own-user policy overrides the class')
      self() {}
      @RequirePermissions() empty() {}
    }
    await expect(
      check(
        context(Controller.prototype.inherited, Controller, ['employees:VIEW']),
      ),
    ).resolves.toBe(true);
    await expect(
      check(
        context(Controller.prototype.override, Controller, ['employees:VIEW']),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      check(context(Controller.prototype.self, Controller)),
    ).resolves.toBe(true);
    await expect(
      check(context(Controller.prototype.empty, Controller, [], 'SUPER_ADMIN')),
    ).rejects.toThrow(ForbiddenException);
  });
  it('does not let a class exemption bypass a method permission', async () => {
    @PermissionExempt('module-reference', 'Class reference policy')
    class Controller {
      @RequirePermissions(allow) route() {}
    }
    await expect(
      check(context(Controller.prototype.route, Controller)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('service-policy declaration still leaves the real asset scope check in force', async () => {
    const ctx = context(AssetsController.prototype.findAll, AssetsController);
    await expect(check(ctx)).resolves.toBe(true);
    const controller = new AssetsController({} as never);
    expect(() => controller.findAll(ctx.switchToHttp().getRequest())).toThrow(
      ForbiddenException,
    );
  });
  it('real appraisal results endpoint now requires appraisal read permission', async () => {
    const handler = AppraisalsController.prototype.getCycleResults;
    await expect(check(context(handler, AppraisalsController))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      check(context(handler, AppraisalsController, ['appraisals:VIEW'])),
    ).resolves.toBe(true);
  });

  it('every PermissionsGuard HTTP route declares permissions or a reviewed policy', () => {
    const missing: string[] = [];
    const decs = (node: ts.ClassDeclaration | ts.MethodDeclaration) =>
      ts.getDecorators(node) ?? [];
    const name = (d: ts.Decorator) =>
      ts.isCallExpression(d.expression)
        ? d.expression.expression.getText()
        : d.expression.getText();
    const declares = (node: ts.ClassDeclaration | ts.MethodDeclaration) =>
      decs(node).some((d) =>
        [
          'RequirePermissions',
          'RequireAnyPermission',
          'PermissionExempt',
        ].includes(name(d)),
      );
    const guarded = (node: ts.ClassDeclaration | ts.MethodDeclaration) =>
      decs(node).some(
        (d) =>
          name(d) === 'UseGuards' &&
          ts.isCallExpression(d.expression) &&
          d.expression.arguments.some(
            (a) => a.getText() === 'PermissionsGuard',
          ),
      );
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(file);
          continue;
        }
        if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
        const sf = ts.createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        const visit = (node: ts.Node) => {
          if (
            ts.isClassDeclaration(node) &&
            decs(node).some((d) => name(d) === 'Controller')
          ) {
            for (const method of node.members.filter(ts.isMethodDeclaration)) {
              if (
                !decs(method).some((d) =>
                  /^(Get|Post|Put|Patch|Delete|Head|Options|All)$/.test(
                    name(d),
                  ),
                )
              )
                continue;
              if (
                (guarded(node) || guarded(method)) &&
                !declares(method) &&
                !declares(node)
              )
                missing.push(file + ':' + method.name.getText());
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(sf);
      }
    };
    scan(join(__dirname, '../..'));
    expect(missing).toEqual([]);
  });
});
