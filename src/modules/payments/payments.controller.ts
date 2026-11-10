import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':reference/verify')
  @ApiOperation({
    summary: 'Verify an owned payment with its original provider',
  })
  @ApiBearerAuth()
  verify(
    @CurrentUser() user: { id: string },
    @Param('reference') reference: string,
  ) {
    return this.payments.verifyForUser(reference, user.id);
  }

  @Public()
  @Post('webhooks/:provider')
  @ApiOperation({ summary: 'Receive authenticated payment provider events' })
  @HttpCode(200)
  webhook(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.payments.handleWebhook(
      provider,
      request.rawBody!,
      request.headers,
    );
  }
}
