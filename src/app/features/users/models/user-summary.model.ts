export interface UserSummaryResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  careerId: string | null;
}

//list admin
export interface UserListItem {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  identificationNumber: string | null;
  role: string;
  careerId: string | null;
  careerName: string | null;
  isActive: boolean;
}


//body put
export interface EditUserRequest {
  name: string;
  lastName: string;
  phone: string;
  identificationNumber: string;
  role: number;
  careerId: string | null;
}

//body post
export interface CreateUserRequest {
  name: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  identificationNumber: string;
  requestedRole: number;
  careerId: string | null;
}