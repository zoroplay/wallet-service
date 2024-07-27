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
  IdRequest,
  Expense,
} from 'src/proto/wallet.pb';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expenses)
    private readonly expensesRepository: Repository<Expenses>,
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
      approvedAmount: values.approved_amount,
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
      const { amount, expenseTypeId, branchId, comment } = data;
      const expenseData = new Expenses();
      expenseData.requested_amount = amount;
      expenseData.branch_id = branchId;
      expenseData.expense_type_id = expenseTypeId;
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
  async findOne(data: IdRequest) {
    try {
      const { id } = data;

      const expense = await this.expensesRepository.findOneBy({
        id,
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
      console.log('1:', 1);
      console.log(
        'branchId __: expense.branch_id',
        expense.branch_id,
        branchId,
      );
      console.log(amount, expenseTypeId, branchId, id, comment);
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
            approved_amount: amount ? Number(amount) : expense.requested_amount,
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
            approved_amount: amount,
            verified_by: verifiedBy,
            admin_comment: comment,
            verified_at: new Date(),
          },
        );
        await this.appService.debitUser({
          userId: adminRef.data.userId,
          clientId: adminRef.data.clientId,
          amount: Expense.requested_amount.toFixed(2),
          source: 'Branch',
          description: Expense.admin_comment,
          username: adminRef.data.username,
          wallet: 'main',
          subject: 'Expenses (Cashbook)',
          channel: 'Cashbook',
        });
        const { data: creditData } = await this.appService.creditUser({
          userId: branchRef.data.userId,
          clientId: branchRef.data.clientId,
          amount: branchRef.cashIn.amount.toFixed(2),
          source: 'Branch',
          description: branchRef.data.branch_comment,
          username: adminRef.data.username,
          wallet: 'main',
          subject: 'Cash In (Cashbook)',
          channel: 'Cashbook',
        });

        const res = this.response({
          ...updatedExpense,
          balance: creditData.balance,
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
  async remove(data: IdRequest): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { id } = data;
      const Expense = await this.expensesRepository.findOneBy({ id });

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
