export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  plan: 'free' | 'pro' | 'premium';
  subscriptionStatus?: 'active' | 'pending' | 'expired';
  pendingPlan?: 'pro' | 'premium';
  role?: 'admin' | 'user';
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: 'pro' | 'premium';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedin?: string;
  website?: string;
  github?: string;
  photo?: string;
}

export interface Education {
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  personalInfo: PersonalInfo;
  education: Education[];
  experience: Experience[];
  skills: string[];
  certifications: string[];
  summary: string;
  templateId: string;
  advancedOptions?: {
    primaryColor?: string;
    fontFamily?: string;
    showIcons?: boolean;
  };
  score?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}
