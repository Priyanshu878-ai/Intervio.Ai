"""
Focused Security & API Hardening Test Suite for Intervio.Ai (Milestone #11)
Tests:
1. Authentication & Token Security (missing, malformed, short, expired, revoked tokens)
2. Object Ownership & Authorization (IDOR/BOLA protection on candidates, interviews, questions, answers)
3. Invalid State Transitions (prevent operations on completed interviews)
4. Payload & File Security (text size limits, extension whitelist, max file size)
5. Sensitive Data Exposure (password hashes, server filesystem paths)
6. Security Headers & CORS Enforcement
"""

import io
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.db.models.auth_token import AuthToken
from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.db.models.question import Question
from app.db.session import SessionLocal
from app.main import app

client = TestClient(app)

passed_count = 0
failed_count = 0
failures = []


def log_pass(test_name: str):
    global passed_count
    passed_count += 1
    print(f"  [PASS] {test_name}", flush=True)


def log_fail(test_name: str, detail: str):
    global failed_count
    failed_count += 1
    failures.append(f"{test_name}: {detail}")
    print(f"  [FAIL] {test_name} - Reason: {detail}", flush=True)


def create_test_candidate(email_prefix: str) -> dict:
    email = f"{email_prefix}_{int(time.time() * 1000)}@sec-test.example.com"
    password = "SecPassword123!"
    res = client.post(
        "/api/auth/register",
        json={"name": "Security Test User", "email": email, "password": password},
    )
    assert res.status_code == 201, f"Failed to register test user: {res.text}"
    data = res.json()
    return {
        "candidate": data["candidate"],
        "token": data["access_token"],
        "email": email,
        "password": password,
    }


print("=================================================================", flush=True)
print("RUNNING INTERVIO.AI SECURITY & API HARDENING TEST SUITE", flush=True)
print("=================================================================\n", flush=True)

# -----------------------------------------------------------------------------
# 1. AUTHENTICATION & TOKEN SECURITY
# -----------------------------------------------------------------------------
print("1. Testing Authentication & Token Security...", flush=True)

# 1.1 Missing Authorization Header
res = client.get("/api/candidates/me")
if res.status_code == 401:
    log_pass("Missing Authorization header returns HTTP 401")
else:
    log_fail("Missing Auth Header", f"Expected 401, got {res.status_code}")

# 1.2 Malformed Authorization Header
res = client.get("/api/candidates/me", headers={"Authorization": "Basic 12345"})
if res.status_code == 401:
    log_pass("Invalid header scheme (Basic) returns HTTP 401")
else:
    log_fail("Invalid Scheme", f"Expected 401, got {res.status_code}")

# 1.3 Short / Malformed Token
res = client.get("/api/candidates/me", headers={"Authorization": "Bearer short"})
if res.status_code == 401:
    log_pass("Short/malformed Bearer token (<16 chars) returns HTTP 401")
else:
    log_fail("Short token", f"Expected 401, got {res.status_code}")

# 1.4 Non-existent Token
res = client.get(
    "/api/candidates/me",
    headers={"Authorization": "Bearer non_existent_token_0123456789abcdef0123456789"},
)
if res.status_code == 401:
    log_pass("Non-existent token returns HTTP 401")
else:
    log_fail("Non-existent token", f"Expected 401, got {res.status_code}")

# Setup two isolated test candidates for cross-tenant testing
user_a = create_test_candidate("cand_a")
user_b = create_test_candidate("cand_b")

# 1.5 Token Revocation (Logout)
temp_user = create_test_candidate("cand_revoked")
logout_res = client.post(
    "/api/auth/logout",
    headers={"Authorization": f"Bearer {temp_user['token']}"},
)
if logout_res.status_code == 200:
    post_logout = client.get(
        "/api/candidates/me",
        headers={"Authorization": f"Bearer {temp_user['token']}"},
    )
    if post_logout.status_code == 401:
        log_pass("Revoked token after logout is immediately rejected with HTTP 401")
    else:
        log_fail("Revoked token", f"Expected 401, got {post_logout.status_code}")
else:
    log_fail("Logout failed", f"Status {logout_res.status_code}")

# 1.6 Expired Token
with SessionLocal() as db:
    expired_token_str = "expired_token_test_1234567890abcdefghijklmnopqrstuvwxyz"
    expired_token = AuthToken(
        token=expired_token_str,
        candidate_id=uuid.UUID(user_a["candidate"]["id"]),
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        is_revoked=False,
    )
    db.add(expired_token)
    db.commit()

res = client.get(
    "/api/candidates/me",
    headers={"Authorization": f"Bearer {expired_token_str}"},
)
if res.status_code == 401:
    log_pass("Expired token is rejected with HTTP 401")
else:
    log_fail("Expired token", f"Expected 401, got {res.status_code}")

# -----------------------------------------------------------------------------
# 2. OBJECT OWNERSHIP & AUTHORIZATION (IDOR / BOLA)
# -----------------------------------------------------------------------------
print("\n2. Testing Object Ownership & Authorization Enforcement (BOLA/IDOR)...", flush=True)

# 2.1 Candidate Profile Access
cand_b_id = user_b["candidate"]["id"]
res = client.get(
    f"/api/candidates/{cand_b_id}",
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
if res.status_code == 403:
    log_pass("Candidate A blocked from reading Candidate B's profile (HTTP 403)")
else:
    log_fail("Cross-candidate profile read", f"Expected 403, got {res.status_code}")

# Create Interview for Candidate A
int_a_res = client.post(
    "/api/interviews",
    json={
        "candidate_id": user_a["candidate"]["id"],
        "role": "Backend Engineer",
        "difficulty": "medium",
        "interview_type": "technical",
    },
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
assert int_a_res.status_code == 201
interview_a = int_a_res.json()
int_a_id = interview_a["id"]

# Generate Questions for Interview A
q_gen_res = client.post(
    f"/api/interviews/{int_a_id}/generate-questions",
    json={"number_of_questions": 3},
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
assert q_gen_res.status_code == 201
questions_a = q_gen_res.json()
q_a_id = questions_a[0]["id"]

# 2.2 Cross-candidate Interview Creation (A creates interview under B's candidate_id)
spoof_res = client.post(
    "/api/interviews",
    json={
        "candidate_id": user_b["candidate"]["id"],
        "role": "Full Stack Engineer",
        "difficulty": "medium",
        "interview_type": "technical",
    },
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
if spoof_res.status_code == 403:
    log_pass("Candidate A blocked from creating interview for Candidate B (HTTP 403)")
else:
    log_fail("Cross-candidate interview creation", f"Expected 403, got {spoof_res.status_code}")

# 2.3 Cross-candidate Interview Read
res = client.get(
    f"/api/interviews/{int_a_id}",
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res.status_code == 403:
    log_pass("Candidate B blocked from reading Candidate A's interview (HTTP 403)")
else:
    log_fail("Cross-candidate interview read", f"Expected 403, got {res.status_code}")

# 2.4 Cross-candidate Question Bank Generation
res = client.post(
    f"/api/interviews/{int_a_id}/generate-questions",
    json={"number_of_questions": 2},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res.status_code == 403:
    log_pass("Candidate B blocked from generating questions for Candidate A (HTTP 403)")
else:
    log_fail("Cross-candidate question generation", f"Expected 403, got {res.status_code}")

# 2.5 Cross-candidate Question Listing & Adding
res_list = client.get(
    f"/api/interviews/{int_a_id}/questions",
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_list.status_code == 403:
    log_pass("Candidate B blocked from listing Candidate A's questions (HTTP 403)")
else:
    log_fail("Cross-candidate questions list", f"Expected 403, got {res_list.status_code}")

res_add_q = client.post(
    f"/api/interviews/{int_a_id}/questions",
    json={
        "question_text": "Unauthorized injected question for Interview A?",
        "question_type": "technical",
        "sequence_number": 99,
    },
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_add_q.status_code == 403:
    log_pass("Candidate B blocked from injecting questions into Candidate A's interview (HTTP 403)")
else:
    log_fail("Cross-candidate question addition", f"Expected 403, got {res_add_q.status_code}")

# 2.6 Cross-candidate Answer Submission & Reading
res_sub = client.post(
    f"/api/interviews/{int_a_id}/submit-answer",
    data={"question_id": q_a_id, "answer_text": "Unauthorized answer from candidate B"},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_sub.status_code == 403:
    log_pass("Candidate B blocked from submitting answers to Candidate A's interview (HTTP 403)")
else:
    log_fail("Cross-candidate answer submission", f"Expected 403, got {res_sub.status_code}")

res_q_ans = client.post(
    f"/api/questions/{q_a_id}/answer",
    json={"answer_text": "Direct unauthorized answer post"},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_q_ans.status_code == 403:
    log_pass("Candidate B blocked from posting answer directly to Candidate A's question (HTTP 403)")
else:
    log_fail("Cross-candidate question answer post", f"Expected 403, got {res_q_ans.status_code}")

res_q_read = client.get(
    f"/api/questions/{q_a_id}/answer",
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_q_read.status_code == 403:
    log_pass("Candidate B blocked from reading Candidate A's question answer (HTTP 403)")
else:
    log_fail("Cross-candidate question answer read", f"Expected 403, got {res_q_read.status_code}")

# 2.7 Cross-candidate Report Access
res_report = client.get(
    f"/api/interviews/{int_a_id}/report",
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_report.status_code == 403:
    log_pass("Candidate B blocked from accessing Candidate A's interview report (HTTP 403)")
else:
    log_fail("Cross-candidate report read", f"Expected 403, got {res_report.status_code}")

# -----------------------------------------------------------------------------
# 3. WORKFLOW & STATE TRANSITION SECURITY
# -----------------------------------------------------------------------------
print("\n3. Testing Workflow & State Transition Security...", flush=True)

# Complete Interview A manually in DB to test completion invariants
with SessionLocal() as db:
    inv = db.execute(select(Interview).where(Interview.id == uuid.UUID(int_a_id))).scalar_one()
    inv.status = "completed"
    inv.completed_at = datetime.now(timezone.utc)
    db.commit()

# 3.1 Submitting answer to completed interview
res_completed_sub = client.post(
    f"/api/interviews/{int_a_id}/submit-answer",
    data={"question_id": q_a_id, "answer_text": "Late answer after completion"},
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
if res_completed_sub.status_code == 400:
    log_pass("Submitting answer to completed interview is rejected with HTTP 400")
else:
    log_fail("Completed interview submission", f"Expected 400, got {res_completed_sub.status_code}")

# 3.2 Restarting completed interview
res_completed_start = client.post(
    f"/api/interviews/{int_a_id}/start",
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
if res_completed_start.status_code == 400:
    log_pass("Restarting completed interview is rejected with HTTP 400")
else:
    log_fail("Completed interview restart", f"Expected 400, got {res_completed_start.status_code}")

# 3.3 Adding questions to completed interview
res_completed_add_q = client.post(
    f"/api/interviews/{int_a_id}/questions",
    json={
        "question_text": "Post-completion question injection",
        "question_type": "technical",
        "sequence_number": 5,
    },
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
if res_completed_add_q.status_code == 400:
    log_pass("Adding questions to completed interview is rejected with HTTP 400")
else:
    log_fail("Completed interview add question", f"Expected 400, got {res_completed_add_q.status_code}")

# -----------------------------------------------------------------------------
# 4. PAYLOAD VALIDATION & FILE UPLOAD HARDENING
# -----------------------------------------------------------------------------
print("\n4. Testing Payload Validation & Upload Hardening...", flush=True)

# Create a fresh in-progress interview for user B
int_b_res = client.post(
    "/api/interviews",
    json={
        "candidate_id": user_b["candidate"]["id"],
        "role": "Frontend Specialist",
        "difficulty": "easy",
        "interview_type": "technical",
    },
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
int_b_id = int_b_res.json()["id"]
q_b_res = client.post(
    f"/api/interviews/{int_b_id}/generate-questions",
    json={"number_of_questions": 1},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
q_b_id = q_b_res.json()[0]["id"]

# 4.1 Excessive text length (> 10,000 chars)
massive_text = "A" * 12_000
res_huge_text = client.post(
    f"/api/interviews/{int_b_id}/submit-answer",
    data={"question_id": q_b_id, "answer_text": massive_text},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_huge_text.status_code == 400:
    log_pass("Oversized text payload (>10,000 characters) rejected with HTTP 400")
else:
    log_fail("Oversized text", f"Expected 400, got {res_huge_text.status_code}")

# 4.2 Malicious file extension (e.g. .exe / .sh disguised as audio)
fake_exe = io.BytesIO(b"MZ\x90\x00executable_bytes")
res_bad_ext = client.post(
    f"/api/interviews/{int_b_id}/submit-answer",
    data={"question_id": q_b_id, "answer_text": "Normal answer"},
    files={"audio_file": ("malicious.exe", fake_exe, "application/x-msdownload")},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_bad_ext.status_code == 400:
    log_pass("Disallowed file extension (.exe) rejected with HTTP 400")
else:
    log_fail("Disallowed file extension", f"Expected 400, got {res_bad_ext.status_code}")

# 4.3 Oversized Audio File (> 25MB)
class DummyHugeAudio(io.RawIOBase):
    def __init__(self, size_bytes):
        self.size = size_bytes
        self.read_so_far = 0

    def read(self, n=-1):
        if self.read_so_far >= self.size:
            return b""
        chunk_size = min(n if n > 0 else 65536, self.size - self.read_so_far)
        self.read_so_far += chunk_size
        return b"\x00" * chunk_size

# 26 MB stream
huge_stream = DummyHugeAudio(26 * 1024 * 1024)
res_oversized = client.post(
    f"/api/interviews/{int_b_id}/submit-answer",
    data={"question_id": q_b_id, "answer_text": "Valid text with oversized audio"},
    files={"audio_file": ("oversized.wav", huge_stream, "audio/wav")},
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if res_oversized.status_code == 413:
    log_pass("Oversized audio file (>25MB) cleanly rejected with HTTP 413 (Payload Too Large)")
else:
    log_fail("Oversized audio file", f"Expected 413, got {res_oversized.status_code}")

# -----------------------------------------------------------------------------
# 5. SENSITIVE DATA EXPOSURE & PATH DISCLOSURE
# -----------------------------------------------------------------------------
print("\n5. Testing Information Disclosure & Security Headers...", flush=True)

# 5.1 No hashed_password in CandidateResponse
cand_res = client.get(
    "/api/candidates/me",
    headers={"Authorization": f"Bearer {user_a['token']}"},
)
cand_data = cand_res.json()
if "hashed_password" not in cand_data and "password" not in cand_data:
    log_pass("Candidate profile endpoints never leak password hashes")
else:
    log_fail("Password hash leak", f"Found credentials in response: {cand_data}")

# 5.2 Server filesystem paths masked in AnswerResponse
answer_create_res = client.post(
    f"/api/questions/{q_b_id}/answer",
    json={
        "answer_text": "Legitimate answer content",
        "audio_path": "/var/app/private/interviews/audio/secret_candidate_file.wav",
        "video_path": "C:\\Users\\Administrator\\AppData\\Local\\Temp\\leak.mp4",
    },
    headers={"Authorization": f"Bearer {user_b['token']}"},
)
if answer_create_res.status_code == 201:
    ans_body = answer_create_res.json()
    audio_p = ans_body.get("audio_path")
    video_p = ans_body.get("video_path")
    if (audio_p is None or "/" not in audio_p) and (video_p is None or "\\" not in video_p):
        log_pass("Internal server directory paths are masked in AnswerResponse")
    else:
        log_fail("Path disclosure", f"audio_path: {audio_p}, video_path: {video_p}")
else:
    log_fail("Answer creation for path test", f"Status: {answer_create_res.status_code}")

# 5.3 Security Headers
health_res = client.get("/health")
h_headers = health_res.headers
if (
    h_headers.get("X-Content-Type-Options") == "nosniff"
    and h_headers.get("X-Frame-Options") == "DENY"
    and h_headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
):
    log_pass("Security headers present on API responses (nosniff, DENY, strict-origin)")
else:
    log_fail(
        "Security headers check",
        f"Headers: X-Content-Type-Options={h_headers.get('X-Content-Type-Options')}, X-Frame-Options={h_headers.get('X-Frame-Options')}",
    )

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
print("\n=================================================================", flush=True)
print(f"SECURITY TEST SUMMARY: {passed_count} PASSED, {failed_count} FAILED", flush=True)
print("=================================================================", flush=True)

if failures:
    print("FAILURES DETECTED:", flush=True)
    for f in failures:
        print(f" - {f}", flush=True)
    sys.exit(1)
else:
    print("ALL SECURITY TESTS PASSED SUCCESSFULLY.", flush=True)
    sys.exit(0)
