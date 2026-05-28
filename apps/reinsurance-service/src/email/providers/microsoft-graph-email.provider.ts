import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailMessageDirection } from '../../../prisma/generated/client';
import {
  EmailProvider,
  EmailProviderMailboxMetadata,
  EmailProviderMessage,
  EmailProviderSyncInput,
  EmailProviderSyncResult,
  EmailProviderVerifyInput,
} from './email-provider.interface';

type GraphUser = {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

type GraphEmailAddress = {
  emailAddress?: {
    address?: string;
    name?: string;
  };
};

type GraphMessage = {
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
};

type GraphMessagesResponse = {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
};

@Injectable()
export class MicrosoftGraphEmailProvider implements EmailProvider {
  async verifyConnection(
    input: EmailProviderVerifyInput,
  ): Promise<EmailProviderMailboxMetadata> {
    const accessToken = this.requireToken(input.accessToken);
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph mailbox verification failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as GraphUser;
    return {
      externalMailboxId: data.id,
      displayName: data.displayName,
      emailAddress: data.mail ?? data.userPrincipalName ?? input.emailAddress,
    };
  }

  async sync(input: EmailProviderSyncInput): Promise<EmailProviderSyncResult> {
    const accessToken = this.requireToken(input.accessToken);
    const params = new URLSearchParams({
      $top: String(input.limit),
      $orderby: 'receivedDateTime desc',
      $select:
        'id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead',
    });
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph sync failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as GraphMessagesResponse;
    return {
      messages: (data.value ?? []).flatMap((message) =>
        this.toProviderMessage(message),
      ),
      nextCursor: data['@odata.nextLink'],
    };
  }

  private requireToken(accessToken?: string): string {
    if (!accessToken) {
      throw new BadRequestException(
        'Microsoft Graph requires an OAuth access token for this operation',
      );
    }
    return accessToken;
  }

  private toProviderMessage(message: GraphMessage): EmailProviderMessage[] {
    if (!message.id || !message.conversationId) return [];

    return [
      {
        providerMessageId: message.id,
        providerThreadId: message.conversationId,
        internetMessageId: message.internetMessageId,
        direction: EmailMessageDirection.INBOUND,
        subject: message.subject,
        fromEmail: message.from?.emailAddress?.address,
        fromName: message.from?.emailAddress?.name,
        toRecipients: this.recipients(message.toRecipients),
        ccRecipients: this.recipients(message.ccRecipients),
        receivedAt: this.toDate(message.receivedDateTime),
        sentAt: this.toDate(message.sentDateTime),
        bodyPreview: message.bodyPreview,
        hasAttachments: message.hasAttachments ?? false,
        isRead: message.isRead ?? false,
      },
    ];
  }

  private recipients(recipients?: GraphEmailAddress[]): unknown {
    return (recipients ?? []).map((recipient) => ({
      email: recipient.emailAddress?.address,
      name: recipient.emailAddress?.name,
    }));
  }

  private toDate(value?: string): Date | undefined {
    return value ? new Date(value) : undefined;
  }
}
