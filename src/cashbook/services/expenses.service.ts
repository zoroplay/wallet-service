/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  ErrorResponse,
  handleError,
  handleResponse,
  SuccessResponse,
} from 'src/common/helpers';
import { Expenses } from '../entities/expenses.entity';
import { IdentityService } from 'src/identity/identity.service';
import { AppService } from 'src/app.service';
import {
  CashbookCreateExpenseRequest,
  BranchRequest,
  CashbookApproveExpenseRequest,
  CashbookIdRequest,
  Expense,
} from 'src/proto/wallet.pb';
import { PaymentService } from 'src/services/payments.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expenses)
    private readonly expensesRepository: Repository<Expenses>,
    private paymentService: PaymentService,
    private identityService: IdentityService,
    private appService: AppService,
  ) {}

  response(values) {
    return {
      id: values.id,
      userId: values.user_id,
      expenseTypeId: values.expense_type_id,
      expenseType: values.expense_type,
      requestedAmount: values.requested_amount,
      amount: values.amount,
      status: values.status,
      branchComment: values.branch_comment,
      adminComment: values.admin_comment,
      verifiedAt: values.verified_at,
      verifiedBy: values.verified_by,
      createdAt: values.created_at,
      balance: values.balance ? values.balance : null,
    };
  }

  async create(
    data: CashbookCreateExpenseRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, expenseTypeId, branchId, comment, clientId } = data;
      const expenseData = new Expenses();
      expenseData.requested_amount = amount;
      expenseData.branch_id = branchId;
      expenseData.expense_type_id = expenseTypeId;
      expenseData.client_id = clientId;
      expenseData.branch_comment = comment;

      const expense = await this.expensesRepository.save(expenseData);
      const res = this.response(expense);

      return handleResponse(res, 'Expense created successfully');
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
      const all = await this.expensesRepository.find();
      const allMap = await Promise.all(
        all.map((item: any) => {
          return this.response({
            ...item,
            expense_type_id: item.expense_type_id.id,
            expense_type: item.expense_type_id.title,
          });
        }),
      );
      return handleResponse(allMap, 'all expenses fetched successfully');
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
      const all = await this.expensesRepository.findBy({
        branch_id: data.branchId,
        client_id: data.clientId,
      });
      const allMap = await Promise.all(
        all.map((item: any) => {
          return this.response({
            ...item,
            expense_type_id: item.expense_type_id.id,
            expense_type: item.expense_type_id.title,
          });
        }),
      );
      return handleResponse(allMap, 'all branch expenses fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllBranchApprovedExpensesWDate(
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
      const expenses = await this.expensesRepository.findBy({
        branch_id: data.branchId,
        status: 1,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        expenses.map((item) => {
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
  async findAllBranchPendingExpensesWDate(
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
      const expenses = await this.expensesRepository.findBy({
        branch_id: data.branchId,
        status: 0,
        created_at: Between(startOfDay, endOfDay),
      });

      const allMap = await Promise.all(
        expenses.map((item) => {
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
  async findOne(data: CashbookIdRequest) {
    try {
      const { id, clientId } = data;

      const expense = await this.expensesRepository.findOneBy({
        id,
        client_id: clientId,
      });
      if (!expense)
        return handleError(
          'Expense with given ID not found',
          null,
          HttpStatus.NOT_FOUND,
        );
      const res = this.response(expense);

      return handleResponse(res, 'Expense with given ID fetched successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async update(
    updateExpenseDto: CashbookCreateExpenseRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, expenseTypeId, branchId, id, comment } = updateExpenseDto;
      const expense = await this.expensesRepository.findOneBy({
        id,
      });

      if (!expense)
        return handleError(
          `Expense does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      if (expense.status === 1)
        return handleError(
          `Expense APPROVED, cannot be edited`,
          null,
          HttpStatus.NOT_ACCEPTABLE,
        );
      let res: Expense;

      if (branchId === expense.branch_id) {
        const updatedExpense = await this.expensesRepository.update(
          { id },
          {
            requested_amount: amount
              ? Number(amount)
              : expense.requested_amount,
            branch_comment: comment ? comment : expense.branch_comment,
            expense_type_id: expenseTypeId
              ? expenseTypeId
              : expense.expense_type_id,
          },
        );
        // res = this.response(updatedExpense);
      } else {
        const updatedExpense = await this.expensesRepository.update(
          { id },
          {
            amount: amount ? Number(amount) : expense.requested_amount,
            admin_comment: comment ? comment : expense.branch_comment,
            expense_type_id: expenseTypeId
              ? expenseTypeId
              : expense.expense_type_id,
          },
        );
        // res = this.response(updatedExpense);
      }

      return handleResponse(res, 'Expense updated successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong`,
        error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async approve(
    approveDto: CashbookApproveExpenseRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { status, verifiedBy, amount, expenseId, comment } = approveDto;
      const [adminRef, Expense]: any = await Promise.all([
        await this.identityService.getUser({ userId: verifiedBy }),
        await this.expensesRepository.findOneBy({
          id: expenseId,
        }),
      ]);

      if (!adminRef.success)
        return handleError(
          `Error! Something went wrong: Authenticated ${adminRef.message}`,
          null,
          HttpStatus.BAD_REQUEST,
        );
      if (!Expense)
        return handleError(
          `Expense does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      const branchRef: any = await this.identityService.getUser(
        Expense.data.branch_id,
      );

      if (status === 1) {
        const updatedExpense = await this.expensesRepository.update(
          { id: expenseId },
          {
            status: 1,
            amount: amount,
            verified_by: verifiedBy,
            admin_comment: comment,
            verified_at: new Date(),
          },
        );
        const transferData = await this.paymentService.walletTransfer({
          clientId: adminRef.data.clientId,
          fromUserId: adminRef.data.id,
          fromUsername: adminRef.data.username,
          toUserId: branchRef.data.id,
          toUsername: branchRef.data.username,
          amount: amount,
          action: 'deposit',
          description: `Transfer of ${amount}  from ${adminRef.data.username} to ${branchRef.data.username}`,
        });

        const res = this.response({
          ...updatedExpense,
          balance: transferData.data.balance,
        });

        return handleResponse(res, 'Expense Approved successfully');
      }
      if (status === 2) {
        const updatedExpense = await this.expensesRepository.update(
          { id: expenseId },
          {
            status: 2,
            verified_by: verifiedBy,
            admin_comment: comment,
            verified_at: null,
          },
        );
        const res = this.response(updatedExpense);

        return handleResponse(res, 'Expense Rejected successfully');
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
  async remove(
    data: CashbookIdRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { id } = data;
      const Expense = await this.expensesRepository.findOneBy({
        id,
        client_id: data.clientId,
      });

      if (!Expense)
        return handleError(
          `Expense does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      await this.expensesRepository.delete({ id });
      return handleResponse(null, 'Expense deleted Successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
