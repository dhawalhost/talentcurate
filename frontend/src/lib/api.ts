export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export interface SessionResponse {
    session_id: string;
    join_url_interviewer: string;
    join_url_candidate: string;
    status: string;
    video_token?: string; // Tokens might be provided in the response
}

export const createSession = async (
    title: string,
    interviewerId: string,
    candidateEmail: string,
    candidateName: string,
    language: string = 'python3',
    templateId?: string,
    opts?: {
        interviewer_ids?: string[];
        scheduled_for?: string;
        duration_minutes?: number;
        interview_type?: string;
    }
): Promise<SessionResponse> => {
    const token = localStorage.getItem('talentcurate_token');
    const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            title,
            interviewer_id: interviewerId,
            interviewer_ids: opts?.interviewer_ids || [],
            candidate_email: candidateEmail,
            candidate_name: candidateName,
            language_preset: language,
            template_id: templateId,
            scheduled_for: opts?.scheduled_for || '',
            duration_minutes: opts?.duration_minutes || 60,
            interview_type: opts?.interview_type || 'technical',
        }),
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
};

export const getSession = async (sessionId: string): Promise<{ session: any }> => {
    // Only fethes the session details, not tokens anymore.
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
    if (!response.ok) throw new Error('Session not found');
    return response.json();
};

export const joinSession = async (sessionId: string, guestData?: { guest_name: string, guest_email: string }): Promise<{ video_token: string, identity: string, interview_type?: string }> => {
    const token = localStorage.getItem('talentcurate_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    // Add auth header if present for interviewers
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/join`, {
        method: 'POST',
        headers,
        body: guestData ? JSON.stringify(guestData) : undefined
    });

    if (!response.ok) {
        if (response.status === 403) {
            throw new Error('Email mismatch');
        }
        throw new Error('Join failed');
    }

    return response.json();
};

export const triggerExecution = async (sessionId: string, language: string, sourceCode: string, stdin: string = "") => {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            language,
            source_code: sourceCode,
            stdin,
            test_cases: [{ id: 'run', is_hidden: false, input: '', expected_output: '' }]
        }),
    });

    if (!response.ok) throw new Error('Execution failed to start');
    return response.json();
};

export interface FeedbackData {
    feedback: string;
    hire_recommendation: string;
    score_algorithms: number;
    score_code_quality: number;
    score_communication: number;
    score_system_design: number;
    score_leadership: number;
    score_problem_solving: number;
    score_culture_fit: number;
    score_domain_knowledge: number;
    interview_notes: string;
}

export const submitFeedback = async (sessionId: string, data: FeedbackData) => {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to submit feedback');
    return response.json();
};

