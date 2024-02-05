import { HttpStatus } from "@nestjs/common";

/* eslint-disable prettier/prettier */
export interface SuccessResponse {
  status: number;
  success: boolean;
  message: string;
  data: any;
}

export interface ErrorResponse {
  status: number;
  message: string;
  success: boolean;
}

export type SuccessResponseFn = (data: any, message: string) => SuccessResponse;
export type ErrorResponseFn = (
  message: string,
  data?: any | null,
  status?: number
) => ErrorResponse;

export const handleResponse: SuccessResponseFn = (data, message) => {
  return {
    status: HttpStatus.OK,
    success: true,
    message,
    data,
  };
};

export const handleError: ErrorResponseFn = (message, data, status) => {
  return {
    status,
    success: false,
    message,
    data
  };
};


export function generateTrxNo() {
  const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const charactersLength = characters.length;
  for ( let i = 0; i < 7; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;

}
