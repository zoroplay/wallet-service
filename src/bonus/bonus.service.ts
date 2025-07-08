import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  BONUS_SERVICE_NAME,
  CheckDepositBonusRequest,
  AwardBonusRequest,
  protobufPackage,
  BonusServiceClient,
} from 'src/proto/bonus.pb';

@Injectable()
export class BonusService {
  private svc: BonusServiceClient;

  @Inject(protobufPackage)
  private readonly client: ClientGrpc;

  public onModuleInit(): void {
    this.svc = this.client.getService<BonusServiceClient>(BONUS_SERVICE_NAME);
  }

  public async getUserBonus(data: CheckDepositBonusRequest) {
    return await firstValueFrom(this.svc.getActiveUserBonus(data));
  }

  public async awardBonus(data: AwardBonusRequest) {
    return await firstValueFrom(this.svc.awardBonus(data));
  }
}
