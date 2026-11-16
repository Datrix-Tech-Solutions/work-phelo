import {
  BadRequestException,
  Controller,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { UsersService } from './users.service';
import {
  verifyAccessRpc,
  EmployeeAccessProof,
} from '@work-phelo/internal-auth';
import {
  EventPatterns,
  WithMeta,
  InviteEmployeeEvent,
  DeactivateEmployeeAccessCommand,
  DeactivateEmployeeAccessResult,
  EmployeeOffboardedEvent,
  ResendEmployeeInviteEvent,
  ProvisionEmployeeInviteCommand,
  DeletePendingEmployeeInviteCommand,
  GetUserStatusesCommand,
  UserStatusSnapshot,
} from '@work-phelo/types';

@Controller()
export class UsersHandler {
  private readonly logger = new Logger(UsersHandler.name);

  constructor(private readonly usersService: UsersService) {}

  private ack(context: RmqContext) {
    const channel = context.getChannelRef() as { ack: (msg: unknown) => void };
    channel.ack(context.getMessage());
  }

  private formatError(error: unknown) {
    const parts: string[] = [];
    const maybeObject =
      error && typeof error === 'object'
        ? (error as {
            constructor?: { name?: string };
            name?: unknown;
            message?: unknown;
            code?: unknown;
            meta?: unknown;
          })
        : undefined;

    if (maybeObject?.constructor?.name) {
      parts.push(`type=${maybeObject.constructor.name}`);
    }
    if (typeof maybeObject?.name === 'string') {
      parts.push(`name=${maybeObject.name}`);
    }

    const message =
      typeof maybeObject?.message === 'string'
        ? maybeObject.message
        : error instanceof Error
          ? error.message
          : String(error);
    parts.push(`message=${message || '<empty>'}`);

    if (typeof maybeObject?.code === 'string') {
      parts.push(`code=${maybeObject.code}`);
    }
    if (maybeObject?.meta !== undefined) {
      parts.push(`meta=${this.safeStringify(maybeObject.meta)}`);
    }

    return parts.join(' ');
  }

  private formatStack(error: unknown) {
    return error instanceof Error && error.stack
      ? error.stack.replace(/\s+/g, ' ')
      : undefined;
  }

  private safeStringify(value: unknown) {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  private shouldRequeue(error: unknown) {
    if (error instanceof HttpException) {
      return false;
    }

    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

    return !['P2002', 'P2003', 'P2014', 'P2025'].includes(code ?? '');
  }

  private settleEventFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    const channel = context.getChannelRef() as {
      ack: (msg: unknown) => void;
      nack: (msg: unknown, allUpTo: boolean, requeue: boolean) => void;
    };
    const message = context.getMessage();

    if (this.shouldRequeue(error)) {
      this.logger.error(
        `[${pattern}] Transient failure — requeueing | ${details} | error=${this.formatError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
      return;
    }

    this.logger.warn(
      `[${pattern}] Permanent failure — acknowledging | ${details} | error=${this.formatError(error)}`,
    );
    channel.ack(message);
  }

  private settleRpcFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    const stack = this.formatStack(error);
    this.logger.warn(
      `[${pattern}] RPC failed | ${details} | error=${this.formatError(error)}${stack ? ` | stack=${stack}` : ''}`,
    );
    this.ack(context);
  }

  private toRpcErrorPayload(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return {
          statusCode: error.getStatus(),
          message: response,
          error: error.name,
        };
      }

      return {
        statusCode: error.getStatus(),
        ...(response as Record<string, unknown>),
      };
    }

    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

    if (code === 'P2002') {
      return {
        statusCode: 409,
        message: 'A record with this field already exists',
        error: 'Conflict',
      };
    }

    return {
      statusCode: 500,
      message: this.formatError(error),
      error: 'Internal Server Error',
    };
  }

  @EventPattern('auth.invite_employee')
  async handleInviteEmployee(
    @Payload() data: WithMeta<InviteEmployeeEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { email, _meta } = data;
    this.logger.log(
      `[auth.invite_employee] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      throw new BadRequestException(
        'Use the authorized durable employee access workflow.',
      );
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'auth.invite_employee',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @MessagePattern(EventPatterns.AUTH_PROVISION_EMPLOYEE_INVITE)
  async handleProvisionEmployeeInvite(
    @Payload() data: WithMeta<ProvisionEmployeeInviteCommand>,
    @Ctx() context: RmqContext,
  ) {
    const { email, _meta } = data;
    this.logger.log(
      `[auth.provision_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      throw new BadRequestException('Use auth.employee_access.execute.v1.');
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.provision_employee_invite',
        error,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_DELETE_PENDING_EMPLOYEE_INVITE)
  async handleDeletePendingEmployeeInvite(
    @Payload()
    envelope: {
      payload: DeletePendingEmployeeInviteCommand;
      proof: EmployeeAccessProof;
    },
    @Ctx() context: RmqContext,
  ) {
    try {
      const { tenantId, userId, email } = verifyAccessRpc(
        'hr-service',
        EventPatterns.AUTH_DELETE_PENDING_EMPLOYEE_INVITE,
        envelope,
      );
      const result = await this.usersService.deletePendingEmployeeInvite(
        tenantId,
        {
          userId,
          email,
        },
      );
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.delete_pending_employee_invite',
        error,
        'signed pending invite cleanup',
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_GET_USER_STATUSES)
  async handleGetUserStatuses(
    @Payload()
    envelope: { payload: GetUserStatusesCommand; proof: EmployeeAccessProof },
    @Ctx() context: RmqContext,
  ): Promise<UserStatusSnapshot[]> {
    try {
      const { tenantId, userIds } = verifyAccessRpc(
        'hr-service',
        EventPatterns.AUTH_GET_USER_STATUSES,
        envelope,
      );
      const result = await this.usersService.getUserStatuses(tenantId, userIds);
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.get_user_statuses',
        error,
        'signed status lookup',
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_DEACTIVATE_EMPLOYEE_ACCESS)
  async handleDeactivateEmployeeAccess(
    @Payload()
    envelope: {
      payload: DeactivateEmployeeAccessCommand;
      proof: EmployeeAccessProof;
    },
    @Ctx() context: RmqContext,
  ): Promise<DeactivateEmployeeAccessResult> {
    try {
      const { tenantId, userId } = verifyAccessRpc(
        'hr-service',
        EventPatterns.AUTH_DEACTIVATE_EMPLOYEE_ACCESS,
        envelope,
      );
      await this.usersService.deactivateEmployeeAccess(tenantId, userId);
      this.ack(context);
      return { deactivated: true };
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.deactivate_employee_access',
        error,
        'signed employee offboarding',
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @EventPattern('hr.employee_offboarded')
  async handleEmployeeOffboarded(
    @Payload() data: WithMeta<EmployeeOffboardedEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { email, _meta } = data;
    this.logger.log(
      `[hr.employee_offboarded] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      throw new BadRequestException('Use the signed employee offboarding RPC.');
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'hr.employee_offboarded',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @EventPattern('auth.resend_employee_invite')
  async handleResendEmployeeInvite(
    @Payload() data: WithMeta<ResendEmployeeInviteEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, _meta } = data;
    this.logger.log(
      `[auth.resend_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      throw new BadRequestException(
        'Use the authorized durable employee invitation resend endpoint.',
      );
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'auth.resend_employee_invite',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }
}
