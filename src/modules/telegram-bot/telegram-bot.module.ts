import { Module } from '@nestjs/common';
import { TelegramBackendRepository } from './repositories/telegram-backend.repository';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  providers: [TelegramBackendRepository, TelegramBotService],
})
export class TelegramBotModule {}
