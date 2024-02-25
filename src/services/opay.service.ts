
import { Injectable } from '@nestjs/common';
import { IdentityService } from 'src/identity/identity.service';

@Injectable()
export class OPayService {
    constructor(
        private identityService: IdentityService
    ) {}

    async updateNotify(param) {}

    async reQueryLookUp(param) {}

}
