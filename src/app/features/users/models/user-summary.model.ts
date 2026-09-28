export interface UserSummaryResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  careerId: string | null;
}