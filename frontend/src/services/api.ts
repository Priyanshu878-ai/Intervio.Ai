import {
  CandidateCreate,
  CandidateResponse,
  CandidateProfileUpdate,
  InterviewCreate,
  InterviewResponse,
  QuestionResponse,
  InterviewSessionResponse,
  SubmitAnswerResponse,
  FinalInterviewReport,
  RegisterRequest,
  LoginRequest,
  TokenResponse,
  InterviewHistoryItem,
  CandidateIntelligenceResponse,
} from '../types/api';

const API_BASE = '/api';
const TOKEN_KEY = 'intervio_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      removeStoredToken();
    }
    let errorDetail = `HTTP ${res.status} Error`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  getStoredToken,
  setStoredToken,
  removeStoredToken,

  // --- Auth APIs ---
  async register(data: RegisterRequest): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<TokenResponse>(res);
    setStoredToken(result.access_token);
    return result;
  },

  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<TokenResponse>(res);
    setStoredToken(result.access_token);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } finally {
      removeStoredToken();
    }
  },

  async getMe(): Promise<CandidateResponse> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<CandidateResponse>(res);
  },

  async updateProfile(data: CandidateProfileUpdate): Promise<CandidateResponse> {
    const res = await fetch(`${API_BASE}/candidates/me`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return handleResponse<CandidateResponse>(res);
  },

  async getMyHistory(): Promise<InterviewHistoryItem[]> {
    const res = await fetch(`${API_BASE}/candidates/me/history`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<InterviewHistoryItem[]>(res);
  },

  async getMyIntelligence(): Promise<CandidateIntelligenceResponse> {
    const res = await fetch(`${API_BASE}/candidates/me/intelligence`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<CandidateIntelligenceResponse>(res);
  },

  // --- Interview APIs ---
  async createCandidate(data: CandidateCreate): Promise<CandidateResponse> {
    const res = await fetch(`${API_BASE}/candidates`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return handleResponse<CandidateResponse>(res);
  },

  async createInterview(data: InterviewCreate): Promise<InterviewResponse> {
    const res = await fetch(`${API_BASE}/interviews`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return handleResponse<InterviewResponse>(res);
  },

  async generateQuestions(interviewId: string, numberOfQuestions?: number): Promise<QuestionResponse[]> {
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/generate-questions`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(numberOfQuestions ? { number_of_questions: numberOfQuestions } : {}),
    });
    return handleResponse<QuestionResponse[]>(res);
  },

  async startInterview(interviewId: string): Promise<InterviewSessionResponse> {
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<InterviewSessionResponse>(res);
  },

  async getSession(interviewId: string): Promise<InterviewSessionResponse> {
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/session`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<InterviewSessionResponse>(res);
  },

  async submitAnswer(
    interviewId: string,
    questionId: string,
    answerText: string,
    audioFile?: File | null,
    videoFile?: File | null,
  ): Promise<SubmitAnswerResponse> {
    const formData = new FormData();
    formData.append('question_id', questionId);
    if (answerText.trim()) {
      formData.append('answer_text', answerText.trim());
    }
    if (audioFile) {
      formData.append('audio_file', audioFile);
    }
    if (videoFile) {
      formData.append('video_file', videoFile);
    }

    const res = await fetch(`${API_BASE}/interviews/${interviewId}/submit-answer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return handleResponse<SubmitAnswerResponse>(res);
  },

  async getReport(interviewId: string): Promise<FinalInterviewReport> {
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/report`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<FinalInterviewReport>(res);
  },
};
