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
  email: string;
  phone: string;
  role: string;
  careerId: string | null;
  careerName: string | null;
  isActive: boolean;
}


//body put
export interface EditUserRequest {
  name: string;
  phone: string;
  role: number;
  careerId: string | null;
}

//body post
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  requestedRole: number;
  careerId: string | null;
}