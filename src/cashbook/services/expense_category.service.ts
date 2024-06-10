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
import { ExpenseCategory } from '../entities/expense_category.entity';
import {
  // CashbookCreateExpenseCategoryRequest,
  // ExpenseCategorySingleResponse,
} from 'src/proto/wallet.pb';

@Injectable()
export class ExpenseCategoryService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly expensecategoryRepository: Repository<ExpenseCategory>,
  ) {}
  // async create(
  //   data: CashbookCreateExpenseCategoryRequest,
  // ): Promise<ExpenseCategorySingleResponse> {
  //   try {
  //     const { title, description } = data;
  //     const expenseCategoryData = new ExpenseCategory();
  //     expenseCategoryData.title = title;
  //     expenseCategoryData.description = description;

  //     const expenseCategory =
  //       await this.expensecategoryRepository.save(expenseCategoryData);
  //     const res = {
  //       id: expenseCategory.id,
  //       title: expenseCategory.title,
  //       description: expenseCategory.description,
  //       createdAt: expenseCategory.created_at,
  //     };
  //     return handleResponse(res, 'Expense category created successfully');
  //   } catch (error) {
  //     return handleError(
  //       `Error! Something went wrong: ${error.message}`,
  //       null,
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  async findAll(): Promise<ErrorResponse | SuccessResponse> {
    try {
      const expenseCategory = await this.expensecategoryRepository.find();
      const allMap = await Promise.all(
        expenseCategory.map((item) => {
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            createdAt: item.created_at,
          };
        }),
      );
      return {
        success: true,
        status: HttpStatus.OK,
        data: allMap,
        message: 'all expenses category fetched successfully',
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
      const expenseCategory = await this.expensecategoryRepository.findOneBy({
        id,
      });
      if (!expenseCategory)
        return handleError(
          'Expense Category with given ID not found',
          null,
          HttpStatus.NOT_FOUND,
        );

      return handleResponse(
        expenseCategory,
        'Expense Category with given ID fetched successfully',
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
      const { title, description } = data;
      const expenseCategory = await this.expensecategoryRepository.findOneBy({
        id,
      });

      if (!expenseCategory)
        return handleError(
          `Expense Category with given ID does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );

      const updatedExpenseCategory =
        await this.expensecategoryRepository.update(
          { id },
          {
            title: title ? title : expenseCategory.title,
            description: description
              ? description
              : expenseCategory.description,
          },
        );
      return handleResponse(
        updatedExpenseCategory,
        'Expense Category updated successfully',
      );
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<ErrorResponse | SuccessResponse> {
    try {
      const expenseCategory = await this.expensecategoryRepository.findOneBy({
        id,
      });

      if (!expenseCategory)
        return handleError(
          `Expense Category does not exist`,
          null,
          HttpStatus.NOT_FOUND,
        );
      await this.expensecategoryRepository.delete({ id });
      return handleResponse(null, 'Expense Category deleted Successfully');
    } catch (error) {
      return handleError(
        `Error! Something went wrong: ${error.message}`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
