/* eslint-disable prettier/prettier */
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErrorResponse,
  handleError,
  handleResponse,
  SuccessResponse,
} from 'src/common/helpers';
import { ExpenseTypes } from '../entities/expense_type.entity';
import { CashbookCreateExpenseTypeRequest } from 'src/proto/wallet.pb';

@Injectable()
export class ExpenseTypesService {
  constructor(
    @InjectRepository(ExpenseTypes)
    private readonly expensetypesRepository: Repository<ExpenseTypes>,
  ) {}
  async create(
    data: CashbookCreateExpenseTypeRequest,
  ): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, fixed, title } = data;
      const expenseTypeData = new ExpenseTypes();
      expenseTypeData.title = title;
      expenseTypeData.amount = amount;
      expenseTypeData.fixed = fixed;

      const expenseType =
        await this.expensetypesRepository.save(expenseTypeData);
      const res = {
        id: expenseType.id,
        amount: expenseType.amount,
        fixed: expenseType.fixed,
        status: expenseType.status,
        title: expenseType.title,
        createdAt: expenseType.created_at,
      };

      return handleResponse(res, 'Expense Type created successfully');
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
      const expenseTypes = await this.expensetypesRepository.find();
      const allExpenseTypes = await Promise.all(
        expenseTypes.map((expenseType) => {
          return {
            id: expenseType.id,
            amount: expenseType.amount,
            fixed: expenseType.fixed,
            status: expenseType.status,
            title: expenseType.title,
            createdAt: expenseType.created_at,
          };
        }),
      );

      return {
        status: HttpStatus.OK,
        success: true,
        message: 'Expense Types fetched successfully',
        data: allExpenseTypes,
      };
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findOne(id: number) {
    try {
      const expenseType = await this.expensetypesRepository.findOneBy({
        id,
      });
      if (!expenseType)
        return handleError(
          'Expense Type with given ID not found',
          null,
          HttpStatus.NOT_FOUND,
        );

      return handleResponse(
        expenseType,
        'Expense Types with given ID fetched successfully',
      );
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  async update(id: number, data): Promise<ErrorResponse | SuccessResponse> {
    try {
      const { amount, fixed, title } = data;
      const expenseType = await this.expensetypesRepository.findOneBy({ id });

      if (!expenseType)
        return handleError(
          `Expense type with given ID does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      if (expenseType.status === 1)
        return handleError(
          `Expense Type APPROVED, cannot be edited`,
          null,
          HttpStatus.NOT_ACCEPTABLE,
        );

      const updatedExpenseType = await this.expensetypesRepository.update(
        { id },
        {
          amount: amount ? Number(amount) : expenseType.amount,
          fixed: fixed ? fixed : expenseType.fixed,
          title: title ? title : expenseType.title,
        },
      );
      return handleResponse(
        updatedExpenseType,
        'Expense type updated successfully',
      );
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // async approve(id: number, data): Promise<ErrorResponse | SuccessResponse> {
  //   try {
  //     const { status } = data;
  //     const expenseType = await this.expensetypesRepository.findOneBy({
  //       id,
  //     });

  //     if (!expenseType)
  //       return handleError(
  //         `Expense does not exist`,
  //         null,
  //         HttpStatus.NOT_FOUND,
  //       );
  //     if (status === 1) {
  //       const updatedExpenseType = await this.expensetypesRepository.update(
  //         { id },
  //         {
  //           status: 1,
  //           approved_at: new Date(),
  //         },
  //       );
  //       return handleResponse(
  //         updatedExpenseType,
  //         'Expense types Approved successfully',
  //       );
  //     }
  //     if (status === 2) {
  //       const updatedExpense = await this.expensetypesRepository.update(
  //         { id },
  //         {
  //           status: 2,
  //           approved_at: null,
  //         },
  //       );
  //       return handleResponse(updatedExpense, 'Expense Type Rejected');
  //     }
  //     return handleError(
  //       `Status state of ${status} does not match expected state`,
  //       null,
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   } catch (error) {
  //     return handleError(
  //       `Error! Something went wrong: ${error.message}`,
  //       null,
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }
  async remove(id: number): Promise<ErrorResponse | SuccessResponse> {
    try {
      const expenseType = await this.expensetypesRepository.findOneBy({ id });

      if (!expenseType)
        return handleError(
          `Expense type does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      await this.expensetypesRepository.delete({ id });
      return handleResponse(null, 'Expense Type deleted Successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
