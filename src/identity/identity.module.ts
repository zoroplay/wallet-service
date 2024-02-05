import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { IDENTITY_PACKAGE_NAME, protobufPackage } from 'src/proto/identity.pb';
import { IdentityService } from './identity.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: protobufPackage,
                transport: Transport.GRPC,
                options: {
                    url: process.env.IDENTITY_SERVICE_URI,
                    package: IDENTITY_PACKAGE_NAME,
                    protoPath: join('node_modules/sbe-service-proto/proto/identity.proto'),
                },
            },
        ]),
    ],
    providers: [IdentityService],
    exports: [IdentityService]
})
export class IdentityModule {}
