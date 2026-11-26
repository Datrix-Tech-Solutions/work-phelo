import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEMO_DISCLAIMER, DEMO_GUIDANCE } from '../inference/demo-guidance';

@Controller()
export class EligibilityController {
  constructor(private readonly config: ConfigService) {}
  // Authentication is enforced by the global exact-handler policy, not an optional decorator.
  @Get('eligibility')
  eligibility() {
    const demo =
      this.config.get<unknown>('AI_INTERNAL_DEMO_ENABLED') === true &&
      ['development', 'test'].includes(this.config.get<string>('NODE_ENV') ?? '') &&
      this.config.get<string>('AI_RUNTIME_SCOPE') === 'isolated-demo';
    return {
      eligible: true,
      inferenceAvailable: false,
      ...(demo
        ? {
            demo: {
              configured: true,
              mode: 'scripted-demo',
              disclaimer: DEMO_DISCLAIMER,
              questions: Object.keys(DEMO_GUIDANCE),
            },
          }
        : {}),
    };
  }
}
