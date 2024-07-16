/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { CashIn } from '../entities/cashin.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  ErrorResponse,
  handleError,
  handleResponse,
  SuccessResponse,
} from 'src/common/helpers';
import { IdentityService } from 'src/identity/identity.service';
import { AppService } from 'src/app.service';
import {
  BranchRequest,
  CashbookApproveCashInOutRequest,
  CashbookCreateCashInOutRequest,
  IdRequest,
} from 'src/proto/wallet.pb';

@Injectable()
export class CashInService {
  constructor(
    @InjectRepository(CashIn)
    private readonly cashinRepository: Repository<CashIn>,
    private identityService: IdentityService,
    private appService: AppService,
  ) {}

  response(values) {
    return {
      id: values.id,
      userId: values.user_id,
      branchId: values.branch_id,
      amount: values.amount,
      status: values.status,
      comment: values.comment,
      verifiedAt: values.verified_at,
      verifiedBy: values.verified_by,
      createdAt: values.created_at,
      balance: values.balance ? values.balance : null,
    };
  }
  async addCashin(
    createCashInDto: CashbookCreateCashInOutRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, branchId, comment, userId } = createCashInDto;
      const [userRes, branchRes] = await Promise.all([
        this.identityService.getUser({ userId }),
        this.identityService.getUser({ userId: branchId }),
      ]);

      if (!userRes.success)
        return handleError(
          `Error! Something went wrong: Authenticated ${userRes.message}`,
          null,
          HttpStatus.BAD_REQUEST,
        );
      if (!branchRes.success)
        return handleError(
          `Error! Something went wrong: Branch ${branchRes.message}`,
          null,
          HttpStatus.BAD_REQUEST,
        );
      const cashinData = new CashIn();
      cashinData.amount = Number(amount);
      cashinData.branch_id = Number(branchId);
      cashinData.user_id = Number(userId);
      cashinData.comment = comment;

      const cashin = await this.cashinRepository.save(cashinData);
      const res = this.response(cashin);
      return handleResponse(res, 'Cash In created successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllCashin(): Promise<ErrorResponse | SuccessResponse> {
    try {
      const all = await this.cashinRepository.find();
      const allMap = await Promise.all(
        all.map((item) => {
          return this.response(item);
        }),
      );

      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-ins fetched successfully',
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllBranchApprovedCashinWDate(
    data: BranchRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const date = new Date(data.date);

      // Calculate the start and end of the specified day
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);
      const cashins = await this.cashinRepository.findBy({
        branch_id: data.branchId,
        status: 1,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        cashins.map((item) => {
          return this.response(item);
        }),
      );

      //  handleResponse(allMap, 'all cash-ins fetched successfully');
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-ins fetched successfully',
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async findAllBranchPendingCashinWDate(
    data: BranchRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const date = new Date(data.date);

      // Calculate the start and end of the specified day
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);
      const cashins = await this.cashinRepository.findBy({
        branch_id: data.branchId,
        status: 0,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        cashins.map((item) => {
          return this.response(item);
        }),
      );
      console.log(allMap);

      //  handleResponse(allMap, 'all cash-ins fetched successfully');
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-ins fetched successfully',
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllBranchCashin(
    data: BranchRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const all = await this.cashinRepository.findBy({
        branch_id: data.branchId,
      });
      console.log('all:', all);
      const allMap = await Promise.all(
        all.map((item) => {
          return this.response(item);
        }),
      );
      console.log(allMap);

      //  handleResponse(allMap, 'all cash-ins fetched successfully');
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-ins fetched successfully',
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findOne(data: IdRequest) {
    try {
      const { id } = data;
      const cashin = await this.cashinRepository.findOneBy({
        id,
      });
      if (!cashin)
        return handleError('cash in not found', null, HttpStatus.NOT_FOUND);

      return handleResponse(cashin, 'Cash in fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(data: IdRequest): Promise<ErrorResponse | SuccessResponse> {
    try {
      const cashin = await this.cashinRepository.findOneBy({ id: data.id });

      if (!cashin)
        return handleError(
          `cash in does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      await this.cashinRepository.delete({ id: data.id });
      return handleResponse(null, 'Cash In deleted Successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // async update(
  //   updateCashInDto: CashbookCreateCashInOutRequest,
  // ): Promise<ErrorResponse | SuccessResponse> {
  //   try {
  //     const { amount, branchId, comment, userId, id } = updateCashInDto;
  //     const cashin = await this.cashinRepository.findOneBy({
  //       id,
  //     });
  //     if (!cashin)
  //       return handleError('cash in not found', null, HttpStatus.NOT_FOUND);

  //     if (cashin.status === 1)
  //       return handleError(
  //         `Cash In APPROVED, cannot be edited`,
  //         null,
  //         HttpStatus.NOT_ACCEPTABLE,
  //       );

  //     const updatedCashIn = await this.cashinRepository.update(
  //       { id },
  //       {
  //         amount: amount ? Number(amount) : cashin.amount,
  //         branch_id: branchId ? branchId : cashin.branch_id,
  //         comment: comment ? comment : cashin.comment,
  //         user_id: userId ? userId : cashin.user_id,
  //       },
  //     );

  //     return handleResponse(updatedCashIn, 'Cash in updated successfully');
  //   } catch (error) {
  //     return handleError(
  //       `Error! Something went wrong: ${error.message}`,
  //       null,
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  async approve(
    approveDto: CashbookApproveCashInOutRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { status, verifiedBy, id } = approveDto;
      const [branchRef, cashIn] = await Promise.all([
        await this.identityService.getUser({ userId: verifiedBy }),
        await this.cashinRepository.findOneBy({
          id,
          branch_id: verifiedBy,
        }),
      ]);

      if (!branchRef.success)
        return handleError(
          `Error! Something went wrong: Authenticated ${branchRef.message}`,
          null,
          HttpStatus.BAD_REQUEST,
        );
      if (!cashIn)
        return handleError(
          `Cash In with provided ID not found`,
          null,
          HttpStatus.NOT_FOUND,
        );
      if (status === 1) {
        const updatedCashin = await this.cashinRepository.update(
          { id },
          {
            status: 1,
            verified_by: verifiedBy,
            verified_at: new Date(),
          },
        );
        const { data }: any = branchRef;
        const { data: creditData } = await this.appService.creditUser({
          userId: data.userId,
          clientId: data.clientId,
          amount: cashIn.amount.toFixed(2),
          source: 'Branch',
          description: cashIn.comment,
          username: data.username,
          wallet: 'main',
          subject: 'Cash In (Cashbook)',
          channel: 'Cashbook',
        });
        const res = this.response({
          ...updatedCashin,
          balance: creditData.balance,
        });

        return handleResponse(res, 'Cash In Approved successfully');
      }
      if (status === 2) {
        const updatedCashin = await this.cashinRepository.update(
          { id },
          {
            status: 2,
            verified_by: verifiedBy,
            verified_at: null,
          },
        );
        const res = this.response(updatedCashin);
        return handleResponse(res, 'Cash In Rejected');
      }
      return handleError(
        `Status state of ${status} does not match expected state`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
