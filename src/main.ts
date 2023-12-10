import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {JsonLoggerService} from 'json-logger-service';
import {MicroserviceOptions, ServerGrpc, Transport} from "@nestjs/microservices";
import {join} from "path";

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  app.useLogger(new JsonLoggerService('Wallet service'));

// microservice #1
  const microserviceGrpc = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: `${process.env.GRPC_HOST}:${process.env.GRPC_PORT}`,
      package: 'wallet',
      protoPath: join('node_modules/sbe-service-proto/proto/wallet.proto'),
    }
  });

  await app.startAllMicroservices();

  await app.listen(5005);
}
bootstrap();
