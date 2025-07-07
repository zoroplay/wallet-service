/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLoggerService } from 'json-logger-service';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { protobufPackage } from './proto/wallet.pb';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        url: `${process.env.GRPC_HOST}:${process.env.GRPC_PORT}`,
        package: protobufPackage,
        protoPath: join('node_modules/sbe-service-proto/proto/wallet.proto'),
      },
    },
  );

  app.useLogger(new JsonLoggerService('Wallet service'));

  await app.listen();
}
bootstrap();
