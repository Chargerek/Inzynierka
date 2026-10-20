export type UserRole = "patient" | "dermatologist" | "admin";

export type User = {
  id: number;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Service = {
  id: number;
  name: string;
  duration_minutes: number;
  price: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};
