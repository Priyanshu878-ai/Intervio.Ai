export interface CandidateCreate {
  name: string;
  email: string;
}

export interface CandidateResponse {
  id: string;
  name: string;
  email: string;
  target_role?: string | null;
  experience_level?: string | null;
  skills?: string | null;
  preferred_interview_type?: string | null;
  created_at: string;
}

export interface CandidateProfileUpdate {
  name?: string;
  target_role?: string;
  experience_level?: string;
  skills?: string;
  preferred_interview_type?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  candidate: CandidateResponse;
}

export interface InterviewHistoryItem {
  id: string;
  candidate_id: string;
  role: string;
  difficulty: string;
  interview_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  overall_score?: number | null;
  performance_level?: 'weak' | 'average' | 'strong' | null;
  total_questions: number;
  answered_questions: number;
}

export interface InterviewCreate {
  candidate_id: string;
  role: string;
  difficulty: string;
  interview_type: string;
}

export interface InterviewResponse {
  id: string;
  candidate_id: string;
  role: string;
  difficulty: string;
  interview_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface QuestionResponse {
  id: string;
  interview_id: string;
  question_text: string;
  question_type: string;
  sequence_number: number;
  created_at: string;
}

export interface AdaptiveStrategyResponse {
  performance_level: 'weak' | 'average' | 'strong';
  next_difficulty: string;
  preferred_question_type: string;
  reason: string;
  strategy: string;
}

export interface MultimodalAnalysisResponse {
  text_score?: number | null;
  audio_score?: number | null;
  vision_score?: number | null;
  final_score: number;
  performance_level: 'weak' | 'average' | 'strong';
  modality_weights_used: Record<string, number>;
  feedback: string;
  strengths: string[];
  improvement_areas: string[];
}

export interface InterviewSessionResponse {
  interview_id: string;
  status: string;
  role: string;
  difficulty: string;
  interview_type: string;
  started_at: string | null;
  completed_at: string | null;
  total_questions: number;
  answered_questions: number;
  remaining_questions: number;
  current_question: QuestionResponse | null;
  is_completed: boolean;
}

export interface SubmitAnswerResponse {
  interview_id: string;
  question_id: string;
  analysis: MultimodalAnalysisResponse;
  next_question: QuestionResponse | null;
  adaptive_strategy?: AdaptiveStrategyResponse | Record<string, any> | null;
  is_completed: boolean;
  session_status: string;
}

export interface CandidateReportSummary {
  id: string;
  name: string;
  email: string;
}

export interface InterviewReportSummary {
  interview_id: string;
  candidate: CandidateReportSummary;
  role: string;
  difficulty: string;
  interview_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_questions: number;
  answered_questions: number;
  unanswered_questions: number;
  completion_percentage: number;
  is_completed: boolean;
}

export interface OverallPerformance {
  overall_score: number | null;
  performance_level: 'weak' | 'average' | 'strong' | null;
  strong_answers_count: number;
  average_answers_count: number;
  weak_answers_count: number;
}

export interface TechnicalPerformance {
  aggregate_technical_score: number | null;
  performance_level: string | null;
  technical_strengths: string[];
  technical_improvement_areas: string[];
}

export interface TextPerformance {
  relevance_score: number | null;
  completeness_score: number | null;
  communication_score: number | null;
  semantic_performance: string | null;
}

export interface AudioPerformance {
  aggregate_audio_communication_score: number | null;
  audio_answered_count: number;
  speaking_rate_wpm: number | null;
  pause_filler_statistics: Record<string, any> | null;
  note: string;
}

export interface VisionPerformance {
  aggregate_visual_communication_score: number | null;
  video_answered_count: number;
  visual_engagement_statistics: Record<string, any> | null;
  note: string;
  disclaimer: string;
}

export interface QuestionAnalytics {
  question_id: string;
  sequence_number: number;
  question_text: string;
  question_type: string;
  difficulty?: string | null;
  answer_status: 'answered' | 'unanswered';
  score: number | null;
  performance_level: 'weak' | 'average' | 'strong' | null;
  evaluation_feedback: string | null;
  relevance_score: number | null;
  technical_score: number | null;
  completeness_score: number | null;
  communication_score: number | null;
  has_audio: boolean;
  has_video: boolean;
  duration_seconds: number | null;
}

export interface PerformanceTransition {
  from_question_seq: number;
  to_question_seq: number;
  from_performance: string;
  to_performance: string;
  transition_type: 'improved' | 'declined' | 'maintained';
}

export interface ProgressionAnalytics {
  score_progression: (number | null)[];
  difficulty_progression: string[];
  performance_transitions: PerformanceTransition[];
  adaptive_strategy_summary: Array<{
    question_sequence: number;
    performance_level: string;
    adaptive_strategy: string;
  }>;
}

export interface FinalInterviewReport {
  interview_summary: InterviewReportSummary;
  overall_performance: OverallPerformance;
  technical_performance: TechnicalPerformance;
  text_performance: TextPerformance;
  audio_performance: AudioPerformance;
  vision_performance: VisionPerformance;
  question_analytics: QuestionAnalytics[];
  progression: ProgressionAnalytics;
  strengths: string[];
  improvement_areas: string[];
  final_summary: string;
}

export interface PerformanceTrendPoint {
  interview_id: string;
  created_at: string;
  role: string;
  difficulty: string;
  interview_type: string;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  relevance_score: number | null;
}

export interface CommunicationTrendPoint {
  interview_id: string;
  created_at: string;
  role: string;
  communication_score: number | null;
  completeness_score: number | null;
}

export interface RoleStat {
  role: string;
  count: number;
  average_score: number | null;
}

export interface InterviewTypeStat {
  interview_type: string;
  count: number;
  average_score: number | null;
}

export interface CandidateIntelligenceResponse {
  has_data: boolean;
  total_interviews: number;
  completed_interviews: number;
  overall_average_score: number | null;
  recent_score: number | null;
  previous_average_score: number | null;
  score_delta: number | null;
  technical_average: number | null;
  communication_average: number | null;
  relevance_average: number | null;
  performance_trend: PerformanceTrendPoint[];
  communication_trend: CommunicationTrendPoint[];
  technical_strengths: string[];
  weak_areas: string[];
  roles_attempted: RoleStat[];
  interview_types_attempted: InterviewTypeStat[];
  recent_improvements: string[];
  suggested_practice_areas: string[];
  overall_progress_summary: string;
}
