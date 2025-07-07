import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { BonusService } from './bonus.service';
import { BONUS_PACKAGE_NAME } from 'src/proto/bonus.pb';
import { protobufPackage } from 'src/proto/wallet.pb';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: protobufPackage,
        transport: Transport.GRPC,
        options: {
          url: process.env.BONUS_SERVICE_URI,
          package: BONUS_PACKAGE_NAME,
          protoPath: join('node_modules/sbe-service-proto/proto/bonus.proto'),
        },
      },
    ]),
  ],
  providers: [BonusService],
  exports: [BonusService],
})
export class BonusModule {}
