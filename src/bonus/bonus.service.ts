/* eslint-disable prettier/prettier */
import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AwardBonusRequest, BONUS_PACKAGE_NAME, BonusServiceClient, CheckDepositBonusRequest, protobufPackage } from 'src/proto/bonus.pb';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BonusService {
  private svc: BonusServiceClient;

  @Inject(protobufPackage)
  private readonly client: ClientGrpc;

  public onModuleInit(): void {
    this.svc = this.client.getService<BonusServiceClient>(
      BONUS_PACKAGE_NAME,
    );
  }

  public async getUserBonus(data: CheckDepositBonusRequest) {
    return await firstValueFrom(this.svc.getActiveUserBonus(data));
  }

  public async awardBonus(data: AwardBonusRequest) {
    return await firstValueFrom(this.svc.awardBonus(data));
  }

}
