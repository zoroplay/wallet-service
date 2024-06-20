/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { CashOut } from '../entities/cashout.entity';
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
export class CashOutService {
  constructor(
    @InjectRepository(CashOut)
    private readonly cashoutRepository: Repository<CashOut>,
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
  async addCashOut(
    createCashOutDto: CashbookCreateCashInOutRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, branchId, comment, userId } = createCashOutDto;
      const [userRes, branchRes] = await Promise.all([
        await this.identityService.getUser({ userId }),
        await this.identityService.getUser({ userId: branchId }),
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

      const cashOutData = new CashOut();
      cashOutData.amount = Number(amount);
      cashOutData.branch_id = Number(branchId);
      cashOutData.user_id = Number(userId);
      cashOutData.comment = comment;

      const cashOut = await this.cashoutRepository.save(cashOutData);
      const res = this.response(cashOut);

      return handleResponse(res, 'Cash Out created successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllBranchApprovedCashoutWDate(
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
      const cashouts = await this.cashoutRepository.findBy({
        branch_id: data.branchId,
        status: 1,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        cashouts.map((item) => {
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
  async findAllBranchPendingCashoutWDate(
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
      const cashouts = await this.cashoutRepository.findBy({
        branch_id: data.branchId,
        status: 0,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        cashouts.map((item) => {
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

  async findAll(): Promise<ErrorResponse | SuccessResponse> {
    try {
      const all = await this.cashoutRepository.find();
      const allMap = await Promise.all(
        all.map((item) => {
          return this.response(item);
        }),
      );
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-outs fetched successfully',
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async findAllBranch(
    data: BranchRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const all = await this.cashoutRepository.findBy({
        branch_id: data.branchId,
      });
      const allMap = await Promise.all(
        all.map((item) => {
          return this.response(item);
        }),
      );
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all cash-outs fetched successfully',
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
      const cashin = await this.cashoutRepository.findOneBy({
        id,
      });
      if (!cashin)
        return handleError('cash out not found', null, HttpStatus.NOT_FOUND);

      return handleResponse(cashin, 'Cash out fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // async update(updateCashInDto): Promise<ErrorResponse | SuccessResponse> {
  //   try {
  //     const { amount, branchId, comment, userId, id } = updateCashInDto;
  //     const cashin = await this.cashoutRepository.findOneBy({
  //       id,
  //     });
  //     if (!cashin)
  //       return handleError(
  //         'cash out with given ID not found',
  //         null,
  //         HttpStatus.NOT_FOUND,
  //       );
  //     if (cashin.status === 1)
  //       return handleError(
  //         `Cash out APPROVED, cannot be edited`,
  //         null,
  //         HttpStatus.NOT_ACCEPTABLE,
  //       );

  //     const updatedCashIn = await this.cashoutRepository.update(
  //       { id },
  //       {
  //         amount: amount ? Number(amount) : cashin.amount,
  //         branch_id: branchId ? branchId : cashin.branch_id,
  //         comment: comment ? comment : cashin.comment,
  //         user_id: userId ? userId : cashin.user_id,
  //       },
  //     );

  //     return handleResponse(updatedCashIn, 'Cash out updated successfully');
  //   } catch (error) {
  //     return handleError(
  //       `Error! Something went wrong: ${error.message}`,
  //       null,
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  async remove(data: IdRequest): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { id } = data;
      const cashout = await this.cashoutRepository.findOneBy({
        id,
      });
      if (!cashout)
        return handleError(
          'cash out with given ID not found',
          null,
          HttpStatus.NOT_FOUND,
        );

      await this.cashoutRepository.delete({
        id,
      });
      return handleResponse(null, 'Cash Out deleted Successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async approve(
    approveDto: CashbookApproveCashInOutRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { status, verifiedBy, id } = approveDto;
      const [branchRef, cashOut] = await Promise.all([
        await this.identityService.getUser({ userId: verifiedBy }),
        await this.cashoutRepository.findOneBy({
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
      if (!cashOut)
        return handleError(
          `Cash out with provided ID not found`,
          null,
          HttpStatus.NOT_FOUND,
        );
      if (status === 1) {
        const updatedCashOut = await this.cashoutRepository.update(
          { id },
          {
            status: 1,
            verified_by: verifiedBy,
            verified_at: new Date(),
          },
        );
        const { data }: any = branchRef;
        const { data: debitData } = await this.appService.debitUser({
          userId: data.userId,
          clientId: data.clientId,
          amount: cashOut.amount.toFixed(2),
          source: 'Branch',
          description: cashOut.comment,
          username: data.username,
          wallet: 'main',
          subject: 'Cash Out (Cashbook)',
          channel: 'Cashbook',
        });
        const res = this.response({
          ...updatedCashOut,
          balance: debitData.balance,
        });
        return handleResponse(res, 'Cash Out Approved successfully');
      }
      if (status === 2) {
        const updatedCashOut = await this.cashoutRepository.update(
          { id },
          {
            status: 2,
            verified_by: verifiedBy,
            verified_at: null,
          },
        );
        const res = this.response(updatedCashOut);
        return handleResponse(res, 'Cash Out Rejected');
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
