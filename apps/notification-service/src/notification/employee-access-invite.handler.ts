import { Controller, Injectable } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import {
  accessFingerprint,
  EmployeeAccessProof,
  verifyAccessRpc,
} from '@work-phelo/internal-auth';
import {
  EmployeeAccessInvite,
  EmployeeAccessInviteResult,
  EmployeeAccessPatterns,
  EmployeeInviteReceiptRequest,
  EmployeeInviteReceiptState,
} from '@work-phelo/types';
import { randomUUID } from 'crypto';
import { isEmail, isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../channels/email.service';

@Injectable()
export class EmployeeAccessInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}
  async inspect(
    input: EmployeeInviteReceiptRequest,
  ): Promise<EmployeeInviteReceiptState> {
    if (!isUUID(input?.operationId) || !input.tenantId || !input.userId)
      throw new Error('Invalid receipt scope');
    const row = await this.prisma.employeeInviteReceipt.findUnique({
      where: { id: input.operationId },
    });
    if (!row) return { status: 'MISSING', errorCode: null };
    if (row.tenantId !== input.tenantId || row.userId !== input.userId)
      return { status: 'BLOCKED', errorCode: 'RECEIPT_SCOPE_MISMATCH' };
    if (row.status === 'PROVIDER_ACCEPTED')
      return { status: 'PROVIDER_ACCEPTED', errorCode: null };
    if (
      row.status === 'UNKNOWN' ||
      row.status === 'EXPIRED' ||
      row.attemptCount >= 8 ||
      Date.now() - row.createdAt.getTime() >= 23 * 3600000 ||
      (row.leaseUntil && row.leaseUntil > new Date())
    )
      return { status: 'BLOCKED', errorCode: 'DELIVERY_REVIEW_REQUIRED' };
    return { status: 'RETRY', errorCode: row.lastErrorCode };
  }
  async deliver(
    input: EmployeeAccessInvite,
  ): Promise<EmployeeAccessInviteResult> {
    if (
      !input ||
      !isUUID(input.operationId) ||
      !input.tenantId ||
      !input.userId ||
      !isEmail(input.email) ||
      !Number.isFinite(Date.parse(input.expiresAt))
    )
      throw new Error('Invalid invitation command');
    if (
      !process.env.FRONTEND_BASE_URL ||
      new URL(input.acceptInviteUrl).origin !==
        new URL(process.env.FRONTEND_BASE_URL).origin
    ) {
      throw new Error('Invalid invitation origin');
    }
    const hash = accessFingerprint(input);
    const receipt = await this.prisma.employeeInviteReceipt.upsert({
      where: { id: input.operationId },
      update: {},
      create: {
        id: input.operationId,
        tenantId: input.tenantId,
        userId: input.userId,
        requestHash: hash,
        status: 'RETRY',
      },
    });
    if (
      receipt.requestHash !== hash ||
      receipt.tenantId !== input.tenantId ||
      receipt.userId !== input.userId
    )
      return { status: 'UNKNOWN' };
    if (receipt.status === 'PROVIDER_ACCEPTED')
      return { status: 'PROVIDER_ACCEPTED' };
    if (receipt.status === 'UNKNOWN' || receipt.status === 'EXPIRED')
      return { status: receipt.status };
    if (Date.parse(input.expiresAt) <= Date.now()) {
      await this.prisma.employeeInviteReceipt.updateMany({
        where: { id: receipt.id, status: { not: 'PROVIDER_ACCEPTED' } },
        data: { status: 'EXPIRED' },
      });
      return { status: 'EXPIRED' };
    }
    // Resend's idempotency window is 24h. Never blindly retry an uncertain send beyond it.
    if (
      Date.now() - receipt.createdAt.getTime() >= 23 * 3600000 ||
      receipt.attemptCount >= 8
    ) {
      await this.prisma.employeeInviteReceipt.updateMany({
        where: { id: receipt.id, status: { not: 'PROVIDER_ACCEPTED' } },
        data: {
          status: 'UNKNOWN',
          lastErrorCode: 'DELIVERY_RECONCILIATION_REQUIRED',
        },
      });
      return { status: 'UNKNOWN' };
    }
    const leaseToken = randomUUID();
    const claim = await this.prisma.employeeInviteReceipt.updateMany({
      where: {
        id: receipt.id,
        status: { in: ['RETRY', 'SENDING'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: {
        status: 'SENDING',
        leaseToken,
        leaseUntil: new Date(Date.now() + 120000),
        attemptCount: { increment: 1 },
      },
    });
    if (!claim.count) return { status: 'RETRY' };
    let accepted = false;
    try {
      accepted = await this.email.sendEmployeeInviteEmail(
        input.email,
        input.firstName,
        input.tenantName,
        input.acceptInviteUrl,
        `employee-access/${receipt.id}`,
      );
    } catch {
      /* Lost provider responses are retried using the same provider idempotency key. */
    }
    await this.prisma.employeeInviteReceipt.updateMany({
      where: { id: receipt.id, leaseToken },
      data: {
        status: accepted ? 'PROVIDER_ACCEPTED' : 'RETRY',
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode: accepted ? null : 'PROVIDER_UNCONFIRMED',
      },
    });
    return { status: accepted ? 'PROVIDER_ACCEPTED' : 'RETRY' };
  }
}

@Controller()
export class EmployeeAccessInviteHandler {
  constructor(private readonly invites: EmployeeAccessInviteService) {}
  @MessagePattern(EmployeeAccessPatterns.receipt)
  async inspect(
    @Payload()
    envelope: {
      payload: EmployeeInviteReceiptRequest;
      proof: EmployeeAccessProof;
    },
    @Ctx() context?: RmqContext,
  ) {
    try {
      return await this.invites.inspect(
        verifyAccessRpc(
          'auth-service',
          EmployeeAccessPatterns.receipt,
          envelope,
        ),
      );
    } catch {
      throw new RpcException({
        statusCode: 503,
        message: 'Invitation receipt could not be confirmed',
      });
    } finally {
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
    }
  }
  @MessagePattern(EmployeeAccessPatterns.notify)
  async deliver(
    @Payload()
    envelope: {
      payload: EmployeeAccessInvite;
      proof: EmployeeAccessProof;
    },
    @Ctx() context?: RmqContext,
  ) {
    let payload: EmployeeAccessInvite;
    try {
      payload = verifyAccessRpc(
        'auth-service',
        EmployeeAccessPatterns.notify,
        envelope,
      );
    } catch {
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid invitation service context',
      });
    }
    try {
      return await this.invites.deliver(payload);
    } catch {
      throw new RpcException({
        statusCode: 503,
        message: 'Invitation result could not be confirmed',
      });
    } finally {
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
    }
  }
}
