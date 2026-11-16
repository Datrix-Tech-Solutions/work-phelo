import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import {
  verifyAccessRpc,
  EmployeeAccessProof,
} from '@work-phelo/internal-auth';
import {
  EmployeeAccessCommandPayload,
  EmployeeAccessPatterns,
  EmployeeAccessReference,
  EmployeeAccessLifecycle,
  EmployeeAccessAccountRequest,
  EmployeeAccessSnapshotRequest,
  EmployeeAccessRecovery,
} from '@work-phelo/types';
import { EmployeeAccessLifecycleService } from './employee-access-lifecycle.service';
import { EmployeeAccessRecoveryService } from './employee-access-recovery.service';
import {
  AccessFailure,
  EmployeeAccessCommandService,
} from './employee-access-command.service';

type Envelope<T> = { payload: T; proof: EmployeeAccessProof };

@Controller()
export class EmployeeAccessCommandHandler {
  constructor(
    private readonly commands: EmployeeAccessCommandService,
    private readonly lifecycle: EmployeeAccessLifecycleService,
    private readonly recovery: EmployeeAccessRecoveryService,
  ) {}
  @MessagePattern(EmployeeAccessPatterns.recover)
  recover(
    @Payload() data: Envelope<EmployeeAccessRecovery>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.recover,
      data,
      (p) => this.recovery.recover(p),
      context,
    );
  }
  @MessagePattern(EmployeeAccessPatterns.lifecycle)
  executeLifecycle(
    @Payload() data: Envelope<EmployeeAccessLifecycle>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.lifecycle,
      data,
      (p) => this.lifecycle.execute(p),
      context,
    );
  }
  @MessagePattern(EmployeeAccessPatterns.account)
  account(
    @Payload() data: Envelope<EmployeeAccessAccountRequest>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.account,
      data,
      (p) => this.lifecycle.account(p),
      context,
    );
  }
  @MessagePattern(EmployeeAccessPatterns.snapshot)
  snapshot(
    @Payload() data: Envelope<EmployeeAccessSnapshotRequest>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.snapshot,
      data,
      (p) => this.lifecycle.snapshot(p),
      context,
    );
  }
  private async call<T extends object>(
    pattern: string,
    data: Envelope<T>,
    operation: (payload: T) => Promise<unknown>,
    context?: RmqContext,
  ) {
    try {
      let payload: T;
      try {
        payload = verifyAccessRpc('hr-service', pattern, data);
      } catch {
        throw new RpcException({
          statusCode: 401,
          message: 'Invalid employee access service context',
        });
      }
      try {
        return await operation(payload);
      } catch (error) {
        if (error instanceof AccessFailure)
          throw new RpcException({
            statusCode: 409,
            message: 'Employee access command rejected',
            code: error.code,
          });
        throw new RpcException({
          statusCode: 503,
          message: 'Employee access command could not be confirmed',
        });
      }
    } finally {
      // Durable callers own retries; release the manual-ack consumer slot on every RPC outcome.
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
    }
  }
  @MessagePattern(EmployeeAccessPatterns.execute)
  execute(
    @Payload() data: Envelope<EmployeeAccessCommandPayload>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.execute,
      data,
      (p) => this.commands.execute(p),
      context,
    );
  }
  @MessagePattern(EmployeeAccessPatterns.finalize)
  finalize(
    @Payload() data: Envelope<EmployeeAccessReference>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.finalize,
      data,
      (p) => this.commands.finalize(p),
      context,
    );
  }
  @MessagePattern(EmployeeAccessPatterns.status)
  status(
    @Payload() data: Envelope<EmployeeAccessReference>,
    @Ctx() context?: RmqContext,
  ) {
    return this.call(
      EmployeeAccessPatterns.status,
      data,
      (p) => this.commands.status(p),
      context,
    );
  }
}
