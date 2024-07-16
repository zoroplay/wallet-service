import { PartialType } from '@nestjs/mapped-types';
import { CreateCashbookDto } from './create-cashbook.dto';

export class UpdateCashbookDto extends PartialType(CreateCashbookDto) {
  id: number;
}
