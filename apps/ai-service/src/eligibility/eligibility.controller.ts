import { Controller, Get } from '@nestjs/common';

@Controller()
export class EligibilityController {
  // Authentication is enforced by the global exact-handler policy, not an optional decorator.
  @Get('eligibility')
  eligibility() {
    return { eligible: true, inferenceAvailable: false };
  }
}
