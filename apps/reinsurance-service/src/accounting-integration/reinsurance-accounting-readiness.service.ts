import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { CounterpartyType, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReinsuranceAccountingClient,
  ReinsuranceAccountingClientError,
} from './reinsurance-accounting-client';
import {
  ProcessAccountingOutboxOptions,
  ReinsuranceAccountingOutboxService,
} from './reinsurance-accounting-outbox.service';

type CounterpartyRecord = Prisma.CounterpartyGetPayload<object>;

type AccountingSubledgerSyncResult =
  | {
      status: 'DISABLED' | 'SKIPPED';
      accountingEnabled: boolean;
      message: string;
    }
  | {
      status: 'SYNCED';
      accountingEnabled: true;
      subledgerId: string;
      subledgerCode?: string;
      subledgerType?: string;
      externalRef: string;
    }
  | {
      status: 'FAILED';
      accountingEnabled: true;
      retryable: boolean;
      statusCode?: number;
      message: string;
    };

@Injectable()
export class ReinsuranceAccountingReadinessService {
  private readonly logger = new Logger(
    ReinsuranceAccountingReadinessService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ReinsuranceAccountingClient,
    private readonly outbox: ReinsuranceAccountingOutboxService,
  ) {}

  status(user: RequestUser) {
    const configuration = this.client.configurationStatus();
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    return {
      accountingEnabled,
      integrationConfigured: configuration.configured,
      baseUrlConfigured: configuration.baseUrlConfigured,
      serviceAuthSecretConfigured: configuration.serviceAuthSecretConfigured,
      sourceEventsActive: false,
      readinessMode:
        'Counterparty subledger readiness and outbox dispatch only. Financial events are not activated.',
      message: accountingEnabled
        ? configuration.configured
          ? 'Accounting integration is configured for readiness checks.'
          : 'Accounting is enabled, but Reinsurance is missing Accounting integration configuration.'
        : 'Accounting module is not enabled for this tenant; Reinsurance business workflows continue without Accounting outbox events.',
    };
  }

  async syncCounterpartyById(user: RequestUser, counterpartyId: string) {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        tenantId: user.tenantId,
        archivedAt: null,
      },
    });
    if (!counterparty) throw new NotFoundException('Counterparty not found');
    return this.syncCounterparty(user, counterparty);
  }

  async syncCounterparty(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ): Promise<AccountingSubledgerSyncResult> {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    if (!accountingEnabled) {
      return {
        status: 'DISABLED',
        accountingEnabled,
        message:
          'Accounting module is not enabled for this tenant; subledger sync skipped.',
      };
    }

    const subledgerType = this.subledgerType(counterparty.type);
    if (!subledgerType) {
      return {
        status: 'SKIPPED',
        accountingEnabled,
        message:
          'Only Cedant and Reinsurer counterparties require Accounting subledger readiness.',
      };
    }

    try {
      const subledger = await this.client.ensureSubledger({
        tenantId: counterparty.tenantId,
        type: subledgerType,
        externalRef: counterparty.id,
        name: counterparty.name,
        metadata: {
          sourceModule: 'REINSURANCE',
          sourceRecordType: 'Counterparty',
          sourceRecordId: counterparty.id,
          counterpartyType: counterparty.type,
        },
      });
      return {
        status: 'SYNCED',
        accountingEnabled,
        subledgerId: subledger.id,
        subledgerCode: subledger.code,
        subledgerType: subledger.type,
        externalRef: counterparty.id,
      };
    } catch (error) {
      const failure = this.failure(error);
      return {
        status: 'FAILED',
        accountingEnabled,
        ...failure,
      };
    }
  }

  async syncCounterpartyBestEffort(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ) {
    const result = await this.syncCounterparty(user, counterparty);
    if (result.status === 'FAILED') {
      this.logger.warn(
        `Accounting subledger readiness failed for counterparty ${counterparty.id}: ${result.message}`,
      );
    }
    return result;
  }

  processPending(user: RequestUser, options: ProcessAccountingOutboxOptions) {
    return this.outbox.processPending(this.prisma, {
      tenantId: user.tenantId,
      limit: options.limit,
    });
  }

  private subledgerType(
    counterpartyType: CounterpartyType,
  ): 'CEDANT' | 'REINSURER' | null {
    if (counterpartyType === CounterpartyType.CEDANT) return 'CEDANT';
    if (counterpartyType === CounterpartyType.REINSURER) return 'REINSURER';
    return null;
  }

  private failure(error: unknown): {
    message: string;
    retryable: boolean;
    statusCode?: number;
  } {
    if (error instanceof ReinsuranceAccountingClientError) {
      return {
        message: error.message,
        retryable: error.retryable,
        statusCode: error.statusCode,
      };
    }
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected Accounting readiness failure',
      retryable: true,
    };
  }
}
