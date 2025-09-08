
export type UserProfile = {
  name: string;
  email: string;
  skills: string[];
  interests?: string[];
  location_pref?: string;
  remote_ok?: boolean;
};

export type Internship = {
  id: string;
  title: string;
  company: string;
  location?: string;
  stipend?: string;
  apply_url?: string;
  description?: string;
  tags: string[];
  source: string;
  score?: number;
};

export type SearchRequest = {
  query?: string;
  skills?: string[];
  location?: string;
  remote_ok?: boolean;
  limit?: number;
};
