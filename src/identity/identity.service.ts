/* eslint-disable prettier/prettier */
import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  FindUserRequest,
  GetClientRequest,
  GetPaymentDataRequest,
  GetUserDetailsRequest,
  IDENTITY_SERVICE_NAME,
  IdentityServiceClient,
  protobufPackage,
  CommonResponseObj as IdentityCommonResponseObj,
  GetAgentUsersRequest,
  SingleItemRequest,
} from 'src/proto/identity.pb';

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

  async getTrackierKeys(param: SingleItemRequest) {
    // console.log(param)
    return firstValueFrom(this.svc.getTrackierKeys(param));
  }


  async getAgents(data) {
    console.log('Fetching agents with:', data);
    console.log(data)
    return await firstValueFrom(this.svc.listAgents(data));
  }

  async getAgentUsers(data) {
    console.log('Fetching agents with:', data);
    console.log(data)
    return await firstValueFrom(this.svc.listAgentUsers(data));
  }
}
