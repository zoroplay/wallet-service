/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from "@nestjs/microservices";
import { wrappers } from "protobufjs";
import { Observable } from "rxjs";
import { Struct } from "./google/protobuf/struct.pb";

export const protobufPackage = "identity";

export interface GetAgentUserRequest {
  branchId: number;
  cashierId: number;
}

export interface FindUserRequest {
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

export interface GetUserIdNameRequest {
  username: string;
  clientId?: number | undefined;
}

export interface GetUserIdNameResponse {
  data: GetUserIdNameResponse_Users[];
}

export interface GetUserIdNameResponse_Users {
  id: number;
  username: string;
}

export interface GetWithdrawalSettingsRequest {
  clientId: number;
  userId?: number | undefined;
}

export interface WithdrawalSettingsResponse {
  autoDisbursement: number;
  autoDisbursementMin: number;
  autoDisbursementMax: number;
  autoDisbursementCount: number;
  minimumWithdrawal: number;
  maximumWithdrawal: number;
  allowWithdrawalComm: number;
  withdrawalComm: number;
}

export interface PlaceBetRequest {
  selections: BetSelection[];
  clientId: number;
  userId?: number | undefined;
  stake: number;
  source: string;
  ipAddress: string;
  betType: string;
  username?: string | undefined;
  minBonus: number;
  maxBonus: number;
  minOdds: number;
  totalOdds: number;
  type: string;
  isBooking: number;
  bonusId?: number | undefined;
  useBonus?: boolean | undefined;
}

export interface BetSelection {
  eventName: string;
  eventType: string;
  eventId: number;
  producerId: number;
  marketId: number;
  marketName: string;
  specifier: string;
  outcomeId: string;
  outcomeName: string;
  odds: number;
  sportId: number;
  sport: string;
  tournament: string;
  category: string;
  matchId: number;
  awayTeam: string;
  homeTeam: string;
  type: string;
  fixed: boolean;
  selectionId: string;
  eventDate: string;
  eventPrefix: string;
  isBonus?: boolean | undefined;
}

export interface GetSettingsRequest {
  clientId: number;
  category: string;
}

export interface SettingsRequest {
  clientId: number;
  inputs: string;
  category?: string | undefined;
  period?: string | undefined;
}

export interface UserRiskSettingsRequest {
  userId: number;
  inputs: string;
  period: string;
}

export interface SaveSegmentRequest {
  clientId: number;
  userId: number;
  title: string;
  minOdd: number;
  minSelection: number;
  message: string;
  id?: number | undefined;
}

export interface GrantBonusRequest {
  clientId: number;
  segmentId: number;
  bonusId: number;
  amount: number;
}

export interface FetchPlayerSegmentRequest {
  clientId: number;
}

export interface GetSegmentPlayerRequest {
  segmentId: number;
}

export interface DeleteItemRequest {
  id: number;
}

export interface AddToSegmentRequest {
  clientId: number;
  playerId: number;
  segmentId: number;
}

export interface UploadPlayersToSegment {
  clientId: number;
  segmentId: number;
  players: string[];
}

export interface FetchPlayerFilterRequest {
  clientId: number;
  startDate: string;
  endDate: string;
  minAmount: number;
  maxAmount: number;
  depositCount: number;
  filterType: number;
  page: number;
}

export interface FetchPlayerFilterResponse {
  status: number;
  success: boolean;
  data: UserInfo[];
  error?: string | undefined;
}

export interface TransactionEntity {
  id: number;
  clientId: number;
  userId: number;
  username: string;
  transactionNo: string;
  amount: number;
  transactionType: string;
  subject: string;
  description: string;
  source: string;
  channel: string;
  balance: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserInfo {
  id: number;
  roleId: string;
  code: string;
  email: string;
  username: string;
  password: string;
  lastLogin: string;
  authCode: string;
  virtualToken: string;
  registrationSource: string;
  verified: boolean;
  status: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  id: number;
  username: string;
  balance: number;
  code?: string | undefined;
  firstName: string;
  lastName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  role?: string | undefined;
  roleId?: number | undefined;
  availableBalance?: number | undefined;
  sportBonusBalance?: number | undefined;
  casinoBonusBalance?: number | undefined;
  virtualBonusBalance?: number | undefined;
  trustBalance?: number | undefined;
  token: string;
  registered: string;
  authCode: string;
  country: string;
  currency: string;
  city: string;
  address: string;
  gender: string;
  dateOfBirth: string;
  status: number;
  group: string;
}

export interface CreateUserRequest {
  clientId: number;
  username: string;
  password: string;
  email?: string | undefined;
  roleId?: number | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phoneNumber?: string | undefined;
  gender?: string | undefined;
  dateOfBirth?: string | undefined;
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  address?: string | undefined;
  language?: string | undefined;
  currency?: string | undefined;
  parent?: number | undefined;
  promoCode?: string | undefined;
  trackingToken?: string | undefined;
  parentId?: number | undefined;
  balance?: number | undefined;
}

export interface UpdateUserRequest {
  clientId: number;
  userId: number;
  username: string;
  password: string;
  email?: string | undefined;
  roleId?: number | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phoneNumber?: string | undefined;
  gender?: string | undefined;
  dateOfBirth?: string | undefined;
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  address?: string | undefined;
  language?: string | undefined;
  currency?: string | undefined;
  parent?: number | undefined;
  promoCode?: string | undefined;
  trackingToken?: string | undefined;
  parentId?: string | undefined;
}

/** user */
export interface User {
  userID: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  country: string;
  gender: string;
  currency: string;
  phone: string;
  roleId: string;
}

export interface RegisterResponse {
  status: number;
  success: boolean;
  data: UserData | undefined;
  error?: string | undefined;
}

/** Login */
export interface LoginRequest {
  clientId: number;
  username: string;
  password: string;
}

export interface LoginResponse {
  status: number;
  success: boolean;
  data: UserData | undefined;
  error?: string | undefined;
}

export interface GetUserDetailsRequest {
  clientId: number;
  userId: number;
}

export interface GetUserDetailsResponse {
  status: number;
  success: boolean;
  message: string;
  data: UserData | undefined;
}

export interface UpdateUserResponse {
  success: boolean;
  message: string;
}

/** Validate */
export interface ValidateRequest {
  token: string;
}

export interface ValidateResponse {
  status: number;
  error: string;
  user?: ValidateResponse_User | undefined;
}

export interface ValidateResponse_User {
  id: number;
  username: string;
}

export interface ValidateClientResponse {
  status: number;
  error: string;
  clientId: number;
}

export interface ClientRequest {
  name: string;
  country: string;
  currency: string;
  apiUrl: string;
  webUrl: string;
  mobileUrl: string;
  shopUrl: string;
  contactNumber: string;
  contactEmail: string;
  clientID: string;
}

export interface RemoveClientRequest {
  clientID: string;
}

export interface RemovePermissionRequest {
  permissionID: string;
}

export interface RoleRequest {
  name: string;
  description?: string | undefined;
  roleType: string;
  roleID?: string | undefined;
}

export interface SaveRoleResponse {
  status: boolean;
  message: string;
  data: Role | undefined;
  errors?: string | undefined;
}

export interface GetRolesResponse {
  status: boolean;
  message: string;
  data: Role[];
  errors?: string | undefined;
}

export interface RemoveRoleRequest {
  roleID: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  roleType: string;
}

export interface PermissionRequest {
  name: string;
  description: string;
  permissionID: string;
}

export interface GetPaymentDataRequest {
  clientId: number;
  userId: number;
  source: string;
}

export interface GetPaymentDataResponse {
  username: string;
  email: string;
  callbackUrl: string;
  siteUrl: string;
}

export interface GetClientRequest {
  id: number;
}

export interface GetClientResponse {
  status: boolean;
  message: string;
  data: ClientData | undefined;
  errors?: string | undefined;
}

export interface CommonResponseArray {
  status?: number | undefined;
  success?: boolean | undefined;
  message: string;
  data: { [key: string]: any }[];
  errors?: string | undefined;
}

export interface CommonResponseObj {
  status?: number | undefined;
  success?: boolean | undefined;
  message: string;
  data?: { [key: string]: any } | undefined;
  errors?: string | undefined;
}

export interface DeleteResponse {
  status: boolean;
  message: string;
}

export interface GetUsersResponse {
  status: boolean;
  message: string;
}

export interface ClientData {
  name: string;
  country: string;
  currency: string;
  website: string;
  contactNumber: string;
  contactEmail: string;
}

export interface SearchPlayerRequest {
  clientId: number;
  searchKey: string;
}

export interface SearchPlayerResponse {
  success: boolean;
  message: string;
  data: Player[];
}

export interface Player {
  id: number;
  code: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  registered: string;
  country: string;
  currency: string;
  status: number;
  verified: number;
  balance: number;
  bonus: number;
  lifeTimeDeposit: number;
  lifeTimeWithdrawal: number;
  openBets: number;
  role: string;
  lastLogin: string;
}

export interface GetUserByUsernameRequest {
  clientId: number;
  username: string;
}

export interface GetUserByUsernameResponse {
  responseCode: string;
  responseMessage: string;
  data: GetUserByUsernameResponse_Data | undefined;
}

export interface GetUserByUsernameResponse_Data {
  referenceID?: string | undefined;
  CustomerName?: string | undefined;
  Phoneno?: string | undefined;
  Status?: string | undefined;
}

export interface OnlinePlayersRequest {
  clientId: number;
  username: string;
  country: string;
  state: string;
  source: string;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface RegistrationReportRequest {
  clientId: number;
  from: string;
  to: string;
  source: string;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PlayersListResponse {
  from: number;
  to: number;
  total: number;
  currentPage: number;
  perPage: number;
  data: Player[];
}

export interface GetPlayerDataRequest {
  clientId: number;
  userId: number;
}

export interface GetPlayerDataResponse {
  success: boolean;
  message: string;
  data?: GetPlayerDataResponse_PlayerData | undefined;
}

export interface GetPlayerDataResponse_PlayerData {
  user: Player | undefined;
  wallet: PlayerWalletData | undefined;
  bonus: PlayerBonusData | undefined;
}

export interface UpdatePlayerDataRequest {
  clientId: number;
  userId: number;
  username: string;
  country: string;
  state: string;
  address: string;
  email: string;
  dateOfBirth: string;
  phoneNumber: string;
  currency: string;
  language: string;
  firstName: string;
  lastName: string;
}

export interface PlayerWalletData {
  sportBalance: number;
  totalDeposits: number;
  sportBonusBalance: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  avgWithdrawals: number;
  lastDepositDate: string;
  lastWithdrawalDate: string;
  lastDepositAmount: number;
  lastWithdrawalAmount: number;
  firstActivityDate: string;
  lastActivityDate: string;
  noOfDeposits: number;
  noOfWithdrawals: number;
}

export interface PlayerBonusData {
}

export interface ChangePasswordRequest {
  clientId: number;
  userId: number;
  oldPassword: string;
  password: string;
}

export interface ResetPasswordRequest {
  clientId: number;
  username: string;
  password: string;
}

export interface PaginationResponse {
  message: string;
  count: number;
  currentPage: number;
  nextPage: number;
  prevPage: number;
  lastPage: number;
  data: string;
}

export interface Country {
  id: number;
  name: string;
  countryCodeLong: string;
  countryCode: string;
  dialCode: string;
  currencyName: string;
  currencySymbol: string;
}

export interface GetStatesRequest {
  countryId: number;
}

export interface SessionRequest {
  clientId: number;
  sessionId: string;
}

export interface State {
  id: number;
  name: string;
}

export interface GetCountryResponse {
  countries: Country[];
}

export interface StateResponse {
  states: State[];
}

export interface XpressLoginRequest {
  clientId: number;
  token: string;
}

export interface XpressLoginResponse {
  status: boolean;
  code: number;
  message: string;
  data?: XpressLoginResponse_XpressData | undefined;
}

export interface XpressLoginResponse_XpressData {
  playerId: string;
  playerNickname: string;
  balance: number;
  sessionId: string;
  group: string;
  currency: string;
}

export interface EmptyRequest {
}

export interface MetaData {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  nextPage: number;
  prevPage: number;
}

export const IDENTITY_PACKAGE_NAME = "identity";

wrappers[".google.protobuf.Struct"] = { fromObject: Struct.wrap, toObject: Struct.unwrap } as any;

export interface IdentityServiceClient {
  register(request: CreateUserRequest): Observable<RegisterResponse>;

  login(request: LoginRequest): Observable<LoginResponse>;

  xpressGameLogin(request: XpressLoginRequest): Observable<XpressLoginResponse>;

  validateAuthCode(request: XpressLoginRequest): Observable<CommonResponseObj>;

  xpressGameLogout(request: SessionRequest): Observable<XpressLoginResponse>;

  validate(request: ValidateRequest): Observable<ValidateResponse>;

  validateClient(request: ValidateRequest): Observable<ValidateClientResponse>;

  getUserDetails(request: GetUserDetailsRequest): Observable<GetUserDetailsResponse>;

  createClient(request: ClientRequest): Observable<CommonResponseObj>;

  createPermission(request: PermissionRequest): Observable<CommonResponseObj>;

  findUser(request: FindUserRequest): Observable<CommonResponseArray>;

  getAgentUser(request: GetAgentUserRequest): Observable<CommonResponseArray>;

  saveRole(request: RoleRequest): Observable<SaveRoleResponse>;

  getRoles(request: EmptyRequest): Observable<GetRolesResponse>;

  getAgencyRoles(request: EmptyRequest): Observable<GetRolesResponse>;

  removeRole(request: RemoveRoleRequest): Observable<DeleteResponse>;

  findAllPermissions(request: EmptyRequest): Observable<CommonResponseArray>;

  findAllClients(request: EmptyRequest): Observable<CommonResponseArray>;

  removeClient(request: RemoveClientRequest): Observable<CommonResponseObj>;

  removePermission(request: RemovePermissionRequest): Observable<CommonResponseObj>;

  updateDetails(request: User): Observable<CommonResponseObj>;

  createRetailUser(request: CreateUserRequest): Observable<CommonResponseObj>;

  createAdminUser(request: CreateUserRequest): Observable<CommonResponseObj>;

  getAdminUsers(request: EmptyRequest): Observable<GetUsersResponse>;

  getClient(request: GetClientRequest): Observable<GetClientResponse>;

  getPaymentData(request: GetPaymentDataRequest): Observable<GetPaymentDataResponse>;

  searchPlayers(request: SearchPlayerRequest): Observable<SearchPlayerResponse>;

  updateUserDetails(request: UpdateUserRequest): Observable<UpdateUserResponse>;

  getUserByUsername(request: GetUserByUsernameRequest): Observable<GetUserByUsernameResponse>;

  onlinePlayersReport(request: OnlinePlayersRequest): Observable<PlayersListResponse>;

  registrationReport(request: RegistrationReportRequest): Observable<PlayersListResponse>;

  fetchPlayerFilters(request: FetchPlayerFilterRequest): Observable<PaginationResponse>;

  getPlayerData(request: GetPlayerDataRequest): Observable<GetPlayerDataResponse>;

  updatePlayerData(request: UpdatePlayerDataRequest): Observable<UpdateUserResponse>;

  changePassword(request: ChangePasswordRequest): Observable<UpdateUserResponse>;

  resetPassword(request: ResetPasswordRequest): Observable<UpdateUserResponse>;

  savePlayerSegment(request: SaveSegmentRequest): Observable<CommonResponseObj>;

  fetchPlayerSegment(request: FetchPlayerSegmentRequest): Observable<CommonResponseArray>;

  addToSegment(request: AddToSegmentRequest): Observable<CommonResponseObj>;

  uploadToSegment(request: UploadPlayersToSegment): Observable<CommonResponseObj>;

  deletePlayerSegment(request: DeleteItemRequest): Observable<CommonResponseObj>;

  removePlayerFromSegment(request: DeleteItemRequest): Observable<CommonResponseObj>;

  getSegmentPlayers(request: GetSegmentPlayerRequest): Observable<CommonResponseArray>;

  grantBonusToSegment(request: GrantBonusRequest): Observable<CommonResponseObj>;

  getCountries(request: EmptyRequest): Observable<CommonResponseArray>;

  getStatesByCoutnry(request: GetStatesRequest): Observable<CommonResponseArray>;

  validateXpressSession(request: SessionRequest): Observable<CommonResponseObj>;

  saveSettings(request: SettingsRequest): Observable<CommonResponseObj>;

  saveRiskSettings(request: SettingsRequest): Observable<CommonResponseObj>;

  saveUserRiskSettings(request: UserRiskSettingsRequest): Observable<CommonResponseObj>;

  getSettings(request: GetSettingsRequest): Observable<CommonResponseArray>;

  validateBet(request: PlaceBetRequest): Observable<CommonResponseObj>;

  getWithdrawalSettings(request: GetWithdrawalSettingsRequest): Observable<WithdrawalSettingsResponse>;

  getUserIdandName(request: GetUserIdNameRequest): Observable<GetUserIdNameResponse>;

  listAgentUsers(request: GetAgentUsersRequest): Observable<CommonResponseArray>;

  listAgents(request: GetAgentUsersRequest): Observable<CommonResponseObj>;

  getUserRiskSettings(request: GetAgentUsersRequest): Observable<CommonResponseObj>;
}

export interface IdentityServiceController {
  register(request: CreateUserRequest): Promise<RegisterResponse> | Observable<RegisterResponse> | RegisterResponse;

  login(request: LoginRequest): Promise<LoginResponse> | Observable<LoginResponse> | LoginResponse;

  xpressGameLogin(
    request: XpressLoginRequest,
  ): Promise<XpressLoginResponse> | Observable<XpressLoginResponse> | XpressLoginResponse;

  validateAuthCode(
    request: XpressLoginRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  xpressGameLogout(
    request: SessionRequest,
  ): Promise<XpressLoginResponse> | Observable<XpressLoginResponse> | XpressLoginResponse;

  validate(request: ValidateRequest): Promise<ValidateResponse> | Observable<ValidateResponse> | ValidateResponse;

  validateClient(
    request: ValidateRequest,
  ): Promise<ValidateClientResponse> | Observable<ValidateClientResponse> | ValidateClientResponse;

  getUserDetails(
    request: GetUserDetailsRequest,
  ): Promise<GetUserDetailsResponse> | Observable<GetUserDetailsResponse> | GetUserDetailsResponse;

  createClient(request: ClientRequest): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  createPermission(
    request: PermissionRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  findUser(
    request: FindUserRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  getAgentUser(
    request: GetAgentUserRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  saveRole(request: RoleRequest): Promise<SaveRoleResponse> | Observable<SaveRoleResponse> | SaveRoleResponse;

  getRoles(request: EmptyRequest): Promise<GetRolesResponse> | Observable<GetRolesResponse> | GetRolesResponse;

  getAgencyRoles(request: EmptyRequest): Promise<GetRolesResponse> | Observable<GetRolesResponse> | GetRolesResponse;

  removeRole(request: RemoveRoleRequest): Promise<DeleteResponse> | Observable<DeleteResponse> | DeleteResponse;

  findAllPermissions(
    request: EmptyRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  findAllClients(
    request: EmptyRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  removeClient(
    request: RemoveClientRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  removePermission(
    request: RemovePermissionRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  updateDetails(request: User): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  createRetailUser(
    request: CreateUserRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  createAdminUser(
    request: CreateUserRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getAdminUsers(request: EmptyRequest): Promise<GetUsersResponse> | Observable<GetUsersResponse> | GetUsersResponse;

  getClient(request: GetClientRequest): Promise<GetClientResponse> | Observable<GetClientResponse> | GetClientResponse;

  getPaymentData(
    request: GetPaymentDataRequest,
  ): Promise<GetPaymentDataResponse> | Observable<GetPaymentDataResponse> | GetPaymentDataResponse;

  searchPlayers(
    request: SearchPlayerRequest,
  ): Promise<SearchPlayerResponse> | Observable<SearchPlayerResponse> | SearchPlayerResponse;

  updateUserDetails(
    request: UpdateUserRequest,
  ): Promise<UpdateUserResponse> | Observable<UpdateUserResponse> | UpdateUserResponse;

  getUserByUsername(
    request: GetUserByUsernameRequest,
  ): Promise<GetUserByUsernameResponse> | Observable<GetUserByUsernameResponse> | GetUserByUsernameResponse;

  onlinePlayersReport(
    request: OnlinePlayersRequest,
  ): Promise<PlayersListResponse> | Observable<PlayersListResponse> | PlayersListResponse;

  registrationReport(
    request: RegistrationReportRequest,
  ): Promise<PlayersListResponse> | Observable<PlayersListResponse> | PlayersListResponse;

  fetchPlayerFilters(
    request: FetchPlayerFilterRequest,
  ): Promise<PaginationResponse> | Observable<PaginationResponse> | PaginationResponse;

  getPlayerData(
    request: GetPlayerDataRequest,
  ): Promise<GetPlayerDataResponse> | Observable<GetPlayerDataResponse> | GetPlayerDataResponse;

  updatePlayerData(
    request: UpdatePlayerDataRequest,
  ): Promise<UpdateUserResponse> | Observable<UpdateUserResponse> | UpdateUserResponse;

  changePassword(
    request: ChangePasswordRequest,
  ): Promise<UpdateUserResponse> | Observable<UpdateUserResponse> | UpdateUserResponse;

  resetPassword(
    request: ResetPasswordRequest,
  ): Promise<UpdateUserResponse> | Observable<UpdateUserResponse> | UpdateUserResponse;

  savePlayerSegment(
    request: SaveSegmentRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  fetchPlayerSegment(
    request: FetchPlayerSegmentRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  addToSegment(
    request: AddToSegmentRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  uploadToSegment(
    request: UploadPlayersToSegment,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  deletePlayerSegment(
    request: DeleteItemRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  removePlayerFromSegment(
    request: DeleteItemRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getSegmentPlayers(
    request: GetSegmentPlayerRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  grantBonusToSegment(
    request: GrantBonusRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getCountries(
    request: EmptyRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  getStatesByCoutnry(
    request: GetStatesRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  validateXpressSession(
    request: SessionRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  saveSettings(
    request: SettingsRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  saveRiskSettings(
    request: SettingsRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  saveUserRiskSettings(
    request: UserRiskSettingsRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getSettings(
    request: GetSettingsRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  validateBet(request: PlaceBetRequest): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getWithdrawalSettings(
    request: GetWithdrawalSettingsRequest,
  ): Promise<WithdrawalSettingsResponse> | Observable<WithdrawalSettingsResponse> | WithdrawalSettingsResponse;

  getUserIdandName(
    request: GetUserIdNameRequest,
  ): Promise<GetUserIdNameResponse> | Observable<GetUserIdNameResponse> | GetUserIdNameResponse;

  listAgentUsers(
    request: GetAgentUsersRequest,
  ): Promise<CommonResponseArray> | Observable<CommonResponseArray> | CommonResponseArray;

  listAgents(
    request: GetAgentUsersRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;

  getUserRiskSettings(
    request: GetAgentUsersRequest,
  ): Promise<CommonResponseObj> | Observable<CommonResponseObj> | CommonResponseObj;
}

export function IdentityServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      "register",
      "login",
      "xpressGameLogin",
      "validateAuthCode",
      "xpressGameLogout",
      "validate",
      "validateClient",
      "getUserDetails",
      "createClient",
      "createPermission",
      "findUser",
      "getAgentUser",
      "saveRole",
      "getRoles",
      "getAgencyRoles",
      "removeRole",
      "findAllPermissions",
      "findAllClients",
      "removeClient",
      "removePermission",
      "updateDetails",
      "createRetailUser",
      "createAdminUser",
      "getAdminUsers",
      "getClient",
      "getPaymentData",
      "searchPlayers",
      "updateUserDetails",
      "getUserByUsername",
      "onlinePlayersReport",
      "registrationReport",
      "fetchPlayerFilters",
      "getPlayerData",
      "updatePlayerData",
      "changePassword",
      "resetPassword",
      "savePlayerSegment",
      "fetchPlayerSegment",
      "addToSegment",
      "uploadToSegment",
      "deletePlayerSegment",
      "removePlayerFromSegment",
      "getSegmentPlayers",
      "grantBonusToSegment",
      "getCountries",
      "getStatesByCoutnry",
      "validateXpressSession",
      "saveSettings",
      "saveRiskSettings",
      "saveUserRiskSettings",
      "getSettings",
      "validateBet",
      "getWithdrawalSettings",
      "getUserIdandName",
      "listAgentUsers",
      "listAgents",
      "getUserRiskSettings",
    ];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcMethod("IdentityService", method)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod("IdentityService", method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const IDENTITY_SERVICE_NAME = "IdentityService";
