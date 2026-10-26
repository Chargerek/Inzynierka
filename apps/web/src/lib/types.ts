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

export type Doctor = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  specialization: string;
  bio: string | null;
};

export type WorkingHours = {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type WorkingHoursEntry = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type TimeSlot = {
  start: string;
  end: string;
};

export type Availability = {
  doctor_id: number;
  date: string;
  slots: TimeSlot[];
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type PatientSummary = {
  id: number;
  first_name: string;
  last_name: string;
};

export type Appointment = {
  id: number;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  service: Service;
  doctor: Doctor | null;
  patient: PatientSummary | null;
};

export type AdminUser = {
  id: number;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
};

export type BodySide = "front" | "back";

export type BodyFigure = "male" | "female";

export type AreaStroke = {
  points: number[];
  radius: number;
};

export type FindingGeometry =
  | {
      kind: "marker";
      x: number;
      y: number;
    }
  | {
      kind: "area";
      strokes: AreaStroke[];
    }
  | {
      kind: "part";
      part: string;
    };

export type FindingPhoto = {
  id: number;
  mime: string;
};

export type SkinFinding = {
  id: number;
  patient_id: number;
  report_id: number | null;
  appointment_id: number | null;
  side: BodySide;
  geometry: FindingGeometry;
  color: string;
  finding_type: string;
  description: string;
  created_at: string;
  photos: FindingPhoto[];
};

export type DoctorPatient = {
  id: number;
  first_name: string;
  last_name: string;
  reports_count: number;
  last_report_at: string | null;
};

export type ReportPhoto = {
  id: number;
  mime: string;
};

export type ReportSummary = {
  id: number;
  patient: PatientSummary;
  doctor_name: string | null;
  body_figure: BodyFigure;
  notes: string;
  findings_count: number;
  photos_count: number;
  created_at: string;
  updated_at: string;
};

export type MedicalReport = ReportSummary & {
  findings: SkinFinding[];
  photos: ReportPhoto[];
};
