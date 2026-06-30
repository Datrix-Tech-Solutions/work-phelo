import { BadRequestException, Injectable } from '@nestjs/common';
import { PlacementDocumentType } from '../../../prisma/generated/client';
import {
  isClosingSlipPayload,
  PlacementDocumentTemplateContext,
  renderClosingSlipTemplate,
} from './templates/closing-slip.template';
import {
  isOfferSlipPayload,
  renderOfferSlipTemplate,
} from './templates/offer-slip.template';

@Injectable()
export class PlacementDocumentTemplateRegistry {
  renderHtml(
    type: PlacementDocumentType,
    payload: unknown,
    context: PlacementDocumentTemplateContext,
  ): string {
    if (type === PlacementDocumentType.CLOSING_SLIP) {
      if (!isClosingSlipPayload(payload)) {
        throw new BadRequestException(
          'CLOSING_SLIP renderPayload is missing closing data',
        );
      }

      return renderClosingSlipTemplate(payload, context);
    }

    if (type === PlacementDocumentType.OFFER_SLIP) {
      if (!isOfferSlipPayload(payload)) {
        throw new BadRequestException(
          'OFFER_SLIP renderPayload is missing participant offer data',
        );
      }

      return renderOfferSlipTemplate(payload, context);
    }

    throw new BadRequestException(`PDF rendering is not supported for ${type}`);
  }
}
