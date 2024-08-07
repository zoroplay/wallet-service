/* eslint-disable prettier/prettier */
import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  FindUserRequest,
  GetAgentUserRequest,
  GetClientRequest,
  GetPaymentDataRequest,
  GetUserDetailsRequest,
  IDENTITY_SERVICE_NAME,
  IdentityServiceClient,
  protobufPackage,
  CommonResponseObj as IdentityCommonResponseObj,
  GetAgentUsersRequest,
} from 'src/proto/identity.pb';
import { CommonResponseObj } from 'src/proto/wallet.pb';

@Injectable()
export class IdentityService {
  private svc: IdentityServiceClient;

  @Inject(protobufPackage)
  private readonly client: ClientGrpc;

  public onModuleInit(): void {
    this.svc = this.client.getService<IdentityServiceClient>(
      IDENTITY_SERVICE_NAME,
    );
  }

  public getClientInfo(data: GetClientRequest) {
    return this.svc.getClient(data);
  }

  public getPaymentData(data: GetPaymentDataRequest) {
    return this.svc.getPaymentData(data);
  }

  public getUserDetails(data: GetUserDetailsRequest) {
    return this.svc.getUserDetails(data);
  }

  async getWithdrawalSettings(clientId) {
    return firstValueFrom(this.svc.getWithdrawalSettings(clientId));
  }
  async getUser({
    userId,
  }: FindUserRequest): Promise<IdentityCommonResponseObj> {
    return firstValueFrom(this.svc.findUser({ userId }));
  }

  async getAgentUser(param: GetAgentUsersRequest) {
    // console.log(param)
    return await firstValueFrom(this.svc.listAgentUsers(param));
  }
}
