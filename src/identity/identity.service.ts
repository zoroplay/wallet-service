import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { GetClientRequest, GetPaymentDataRequest, IDENTITY_SERVICE_NAME, IdentityServiceClient, protobufPackage } from 'src/proto/identity.pb';

@Injectable()
export class IdentityService {
    private svc: IdentityServiceClient;

    @Inject(protobufPackage)
    private readonly client: ClientGrpc;

    public onModuleInit(): void {
        this.svc = this.client.getService<IdentityServiceClient>(IDENTITY_SERVICE_NAME);
    }

    public getClientInfo(data: GetClientRequest) {
        return this.svc.getClient(data);
    }

    public getUserData(data: GetPaymentDataRequest) {
        return this.svc.getPaymentData(data);
    }
}

