import { BadRequestException, Injectable } from '@nestjs/common';
import { PlacementDocumentType } from '../../../prisma/generated/client';
import {
  isClosingSlipPayload,
  PlacementDocumentTemplateContext,
  renderClosingSlipTemplate,
} from './templates/closing-slip.template';

@Injectable()
export class PlacementDocumentTemplateRegistry {
  renderHtml(
    type: PlacementDocumentType,
    payload: unknown,
    context: PlacementDocumentTemplateContext,
  ): string {
    if (type !== PlacementDocumentType.CLOSING_SLIP) {
      throw new BadRequestException(
        `PDF rendering is not supported for ${type}`,
      );
    }

    if (!isClosingSlipPayload(payload)) {
      throw new BadRequestException(
        'CLOSING_SLIP renderPayload is missing closing data',
      );
    }

    return renderClosingSlipTemplate(payload, context);
  }
}
