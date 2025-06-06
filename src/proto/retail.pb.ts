// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v1.181.2
//   protoc               v3.21.12
// source: retail.proto

/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from "@nestjs/microservices";
import { Observable } from "rxjs";

export const protobufPackage = "retail";

export interface ProcessRetailTransaction {
  id: number;
  clientId: number;
  userId: number;
  username: string;
  amount: number;
  withdrawalCharge: number;
}

export interface WalletTransferRequest {
  clientId: number;
  toUserId: number;
  toUsername: string;
  fromUsername: string;
  fromUserId: number;
  amount: number;
  description?: string | undefined;
  action: string;
}

export interface ValidateTransactionRequest {
  clientId: number;
  userId: number;
  code: string;
  userRole: string;
}

export interface GetAgentUserRequest {
  clientId: number;
  userId: number;
}

export interface GetAgentUsersRequest {
  clientId: number;
  userId?: number | undefined;
  username?: string | undefined;
  roleId?: number | undefined;
  state?: number | undefined;
  page?: number | undefined;
}

export interface Empty {
}

/** Bonus */
export interface BonusGroup {
  group: string;
  maxSel: number;
  minSel: number;
  rate: number;
  rateIsLess: number;
  rateIsMore: number;
  targetCoupon: number;
  targetStake: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface BonusGroups {
  bonusGroups: BonusGroup[];
}

export interface BonusGroupResponse {
  success: boolean;
  message: string;
  data: BonusGroup[];
}

/** Commission Profile */
export interface CommissionProfile {
  id?: number | undefined;
  name: string;
  default: boolean;
  description: string;
  providerGroup: string;
  period: string;
  type: string;
  percentage: number;
  commissionType: number;
  turnovers: CommissionTurnover[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface CommissionProfileResponse {
  success: boolean;
  message: string;
  data: CommissionProfile | undefined;
}

export interface CommissionProfilesResponse {
  success: boolean;
  message: string;
  data: CommissionProfile[];
}

export interface AssignUserCommissionProfile {
  profileId: number;
  userId: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

/** Power Bonus */
export interface PowerRequest {
  agentIds: number[];
  clientId: number;
  fromDate: string;
  toDate: string;
}

export interface BetData {
  id?: number | undefined;
  betId: number;
  userId: number;
  clientId: number;
  selectionCount: number;
  cancelledDate?: string | undefined;
  settledDate?: string | undefined;
  stake: number;
  commission: number;
  winnings: number;
  weightedStake: number;
  odds: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface Response {
  success: boolean;
  message: string;
}

export interface PowerBonusData {
  id?: number | undefined;
  totalStake: number;
  totalTickets: number;
  totalWeightedStake: number;
  averageNoOfSelections: number;
  grossProfit: number;
  ggrPercent: number;
  rateIsLess: number;
  rateIsMore: number;
  rate: number;
  turnoverCommission: number;
  monthlyBonus: number;
  totalWinnings: number;
  bets: BetData[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface PayPowerRequest {
  clientId: number;
  agentIds: number[];
  fromDate: string;
  toDate: string;
  provider: string;
}

export interface PowerCountData {
  paidUsers: string[];
  unPaidUsers: string[];
  errors: string[];
}

export interface PowerResponse {
  success: boolean;
  message: string;
  data: PowerCountData | undefined;
}

export interface PowerBonusResponse {
  success: boolean;
  message: string;
  data: PowerBonusData | undefined;
}

/** Normal Bonus */
export interface GetNormalRequest {
  fromDate: string;
  toDate: string;
  provider: string;
  meta?: Meta | undefined;
}

export interface PayNormalRequest {
  id?: number | undefined;
  betId: number;
  selectionsCount: number;
  totalOdds: number;
  stake: number;
  clientId: number;
  cashierId: number;
  profileId?: number | undefined;
  commission?: number | undefined;
  profileGroup: string;
  isPaid?: boolean | undefined;
}

export interface CurrentWeekData {
  totalWeeks: number;
  currentWeek: number;
  noOfTickets: number;
  played: number;
  won: number;
  net: number;
  commission: number;
}

export interface CurrentMonth {
  month: string;
}

export interface Meta {
  total?: number | undefined;
  totalPages?: number | undefined;
  currentPage: number;
  itemsPerPage: number;
}

export interface NormalResponse {
  success?: boolean | undefined;
  message?: string | undefined;
  data: NormalPayout[];
  meta?: Meta | undefined;
}

export interface PayNormalResponse {
  success: boolean;
  message: string;
  data: number;
}

export interface NormalPayout {
  id?: number | undefined;
  betId: number;
  selectionsCount: number;
  totalOdds: number;
  stake: number;
  cashierId: number;
  profileId: number;
  profileGroup: string;
  commission: number;
  isPaid: boolean;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

/** Commission Reequest */
export interface CommissionRequest {
  provider: string;
}

export interface ArrayCommissionResponse {
  commissions: Commission[];
}

export interface Commission {
  id?: number | undefined;
  userId: number;
  totalTickets: number;
  totalSales: number;
  totalWon: number;
  net: number;
  commission: number;
  startDate: string;
  endDate: string;
  isPaid: boolean;
  userCommissionProfileId: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface CommissionTurnover {
  id?: number | undefined;
  event: number;
  commissionProfile?: CommissionProfile | undefined;
  percentage: number;
  maxOdd: number;
  minOdd: number;
  oddSet: boolean;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export const RETAIL_PACKAGE_NAME = "retail";

export interface RetailServiceClient {
  onBetPlaced(request: BetData): Observable<Response>;

  onBetSettled(request: BetData): Observable<Response>;

  onBetCancelled(request: BetData): Observable<Response>;
}

export interface RetailServiceController {
  onBetPlaced(request: BetData): Promise<Response> | Observable<Response> | Response;

  onBetSettled(request: BetData): Promise<Response> | Observable<Response> | Response;

  onBetCancelled(request: BetData): Promise<Response> | Observable<Response> | Response;
}

export function RetailServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = ["onBetPlaced", "onBetSettled", "onBetCancelled"];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcMethod("RetailService", method)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod("RetailService", method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const RETAIL_SERVICE_NAME = "RetailService";
