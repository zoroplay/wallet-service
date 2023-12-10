/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from "@nestjs/microservices";
import { Observable } from "rxjs";

export const protobufPackage = "wallet";

/** get user balance */
export interface GetBalanceRequest {
  userId: number;
  clientId: number;
}

export interface GetBalanceResponse {
  status: number;
  success: boolean;
  message: string;
  balance?: number | undefined;
}

/** credit user request payload */
export interface CreditUserRequest {
  userId: number;
  clientId: number;
  amount: number;
  source: string;
  description: string;
  itemId: string;
}

/** credit user request payload */
export interface DebitUserRequest {
  userId: number;
  clientId: number;
  amount: number;
  source: string;
  description: string;
  itemId: string;
}

export const WALLET_PACKAGE_NAME = "wallet";

export interface WalletServiceClient {
  getBalance(request: GetBalanceRequest): Observable<GetBalanceResponse>;

  creditUser(request: CreditUserRequest): Observable<GetBalanceResponse>;

  debitUser(request: DebitUserRequest): Observable<GetBalanceResponse>;
}

export interface WalletServiceController {
  getBalance(
    request: GetBalanceRequest,
  ): Promise<GetBalanceResponse> | Observable<GetBalanceResponse> | GetBalanceResponse;

  creditUser(
    request: CreditUserRequest,
  ): Promise<GetBalanceResponse> | Observable<GetBalanceResponse> | GetBalanceResponse;

  debitUser(
    request: DebitUserRequest,
  ): Promise<GetBalanceResponse> | Observable<GetBalanceResponse> | GetBalanceResponse;
}

export function WalletServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = ["getBalance", "creditUser", "debitUser"];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcMethod("WalletService", method)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod("WalletService", method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const WALLET_SERVICE_NAME = "WalletService";
