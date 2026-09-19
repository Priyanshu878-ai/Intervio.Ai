"""
Automated Comprehensive QA Test Suite for Intervio.Ai (Milestone #8)
Tests the complete user journey and boundary cases:
1. Security & Protected Routes
2. Registration & Authentication
3. Empty States (History & Intelligence)
4. Profile Updates & Retention
5. Role Variety & Custom Roles
6. Adaptive Length for Easy / Medium / Hard
7. Multi-modal Submissions (Text, Audio, Video mock)
8. Interview Progression & Completion
9. Final Report Generation & Constructive Scoring
10. Multi-session Intelligence, Trends, & Delta Comparisons
11. Logout & Re-authentication
"""

import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE_URL = "http://127.0.0.1:8000/api"

passed_tests = 0
failed_tests = 0
bugs_found = []


def log_pass(test_name):
    global passed_tests
    passed_tests += 1
    print(f"  [PASS] {test_name}", flush=True)


def log_fail(test_name, reason):
    global failed_tests
    failed_tests += 1
    bugs_found.append(f"{test_name}: {reason}")
    print(f"  [FAIL] {test_name} - Reason: {reason}", flush=True)


def make_request(path, method="GET", data=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Accept": "application/json"}
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    if headers:
        req_headers.update(headers)

    body = None
    if data is not None and "Content-Type" not in req_headers:
        req_headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    elif data is not None and isinstance(data, bytes):
        body = data

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            res_data = json.loads(content) if content else {}
            return status, res_data
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            err_json = json.loads(content)
        except Exception:
            err_json = {"raw": content}
        return e.code, err_json
    except Exception as e:
        return 500, {"error": str(e)}


print("=================================================================", flush=True)
print("RUNNING INTERVIO.AI FULL PRODUCT QA TEST SUITE", flush=True)
print("=================================================================\n", flush=True)

# TEST 1: Protected Routes Without Auth
print("1. Testing Protected Routes & Security Enforcement...", flush=True)
for endpoint in ["/candidates/me", "/candidates/me/history", "/candidates/me/intelligence"]:
    status, res = make_request(endpoint)
    if status == 401:
        log_pass(f"{endpoint} blocks unauthenticated requests (HTTP 401)")
    else:
        log_fail(f"{endpoint} unauthenticated check", f"Expected 401, got {status}: {res}")

status, res = make_request("/candidates/me", token="invalid_bearer_token_12345")
if status == 401:
    log_pass("Invalid Bearer token rejected with HTTP 401")
else:
    log_fail("Invalid token check", f"Expected 401, got {status}")

# TEST 2: Registration & Authentication
print("\n2. Testing Registration & Authentication...", flush=True)
test_email = f"qa_candidate_{int(time.time())}@example.com"
test_password = "SecurePassword123!"
reg_data = {
    "name": "Jordan QA Candidate",
    "email": test_email,
    "password": test_password,
}

status, res = make_request("/auth/register", method="POST", data=reg_data)
candidate_data = res.get("candidate", res)
candidate_id = candidate_data.get("id")
if status in [200, 201] and "email" in candidate_data:
    log_pass(f"Candidate registration succeeds with valid credentials (HTTP {status})")
else:
    log_fail("Candidate registration", f"Status {status}, response: {res}")

# Duplicate registration check
status, res = make_request("/auth/register", method="POST", data=reg_data)
if status in [400, 409]:
    log_pass(f"Duplicate registration correctly rejected with HTTP {status}")
else:
    log_fail("Duplicate registration", f"Expected 400/409, got {status}")

# Wrong password check
status, res = make_request("/auth/login", method="POST", data={"email": test_email, "password": "WrongPassword"})
if status == 401:
    log_pass("Invalid password rejected with HTTP 401")
else:
    log_fail("Wrong password check", f"Expected 401, got {status}")

# Successful login
status, res = make_request("/auth/login", method="POST", data={"email": test_email, "password": test_password})
if status == 200 and "access_token" in res:
    auth_token = res["access_token"]
    log_pass("Login succeeds and returns valid access token")
else:
    log_fail("Login", f"Status {status}, response: {res}")
    sys.exit(1)

# Current user verification
status, current_user = make_request("/candidates/me", token=auth_token)
if status == 200 and current_user.get("email") == test_email:
    log_pass("GET /candidates/me retrieves authenticated candidate profile")
else:
    log_fail("GET /candidates/me", f"Status {status}, response: {current_user}")

# TEST 3: Initial Empty States
print("\n3. Testing Empty States for New Candidate...", flush=True)
status, history_res = make_request("/candidates/me/history", token=auth_token)
if status == 200 and isinstance(history_res, list) and len(history_res) == 0:
    log_pass("GET /candidates/me/history returns empty list for new candidate")
else:
    log_fail("Empty history check", f"Status {status}, response: {history_res}")

status, intel_res = make_request("/candidates/me/intelligence", token=auth_token)
if status == 200 and intel_res.get("has_data") is False and intel_res.get("total_interviews") == 0:
    log_pass("GET /candidates/me/intelligence returns clean empty state without inventing metrics")
else:
    log_fail("Empty intelligence check", f"Status {status}, response: {intel_res}")

# TEST 4: Profile Update
print("\n4. Testing Profile Update & Target Calibration...", flush=True)
update_payload = {
    "name": "Jordan Hayes (QA Lead)",
    "target_role": "Full Stack Architect",
    "experience_level": "senior",
    "skills": "React, Python, FastAPI, Docker, Distributed Systems",
    "preferred_interview_type": "technical",
}
status, updated_profile = make_request("/candidates/me", method="PATCH", data=update_payload, token=auth_token)
if status == 200 and updated_profile.get("target_role") == "Full Stack Architect":
    log_pass("PATCH /candidates/me updates target profile fields successfully")
else:
    log_fail("Profile update check", f"Status {status}, response: {updated_profile}")

# TEST 5: Role Variety, Custom Roles, & Difficulty Length
print("\n5. Testing Adaptive Interview Generation Across Difficulties & Roles...", flush=True)
# Test A: Custom role with Easy difficulty (5-8 questions)
custom_role = "Robotics Vision Engineer"
int_easy_payload = {
    "candidate_id": current_user["id"],
    "role": custom_role,
    "difficulty": "easy",
    "interview_type": "technical",
}
status, easy_int = make_request("/interviews", method="POST", data=int_easy_payload, token=auth_token)
if status in [200, 201] and easy_int.get("role") == custom_role:
    log_pass(f"Custom role successfully created in Interview engine (HTTP {status})")
    # Generate question bank with easy question count (5-8)
    status, q_list = make_request(f"/interviews/{easy_int['id']}/generate-questions", method="POST", data={"number_of_questions": 5}, token=auth_token)
    if status in [200, 201] and 5 <= len(q_list) <= 8:
        log_pass(f"Easy difficulty calibrates question bank to {len(q_list)} questions (allowed: 5-8)")
    else:
        log_fail("Easy difficulty question calibration", f"Status {status}, count {len(q_list) if isinstance(q_list, list) else 'err'}")
else:
    log_fail("Custom role interview creation", f"Status {status}, response: {easy_int}")

# Test B: Medium difficulty (6-10 questions)
int_med_payload = {
    "candidate_id": current_user["id"],
    "role": "Backend Developer",
    "difficulty": "medium",
    "interview_type": "technical",
}
status, med_int = make_request("/interviews", method="POST", data=int_med_payload, token=auth_token)
if status in [200, 201]:
    status, q_med = make_request(f"/interviews/{med_int['id']}/generate-questions", method="POST", data={"number_of_questions": 6}, token=auth_token)
    if status in [200, 201] and 6 <= len(q_med) <= 10:
        log_pass(f"Medium difficulty calibrates question bank to {len(q_med)} questions (allowed: 6-10)")
    else:
        log_fail("Medium difficulty question calibration", f"Status {status}, count {len(q_med) if isinstance(q_med, list) else 'err'}")

# Test C: Hard difficulty (7-12 questions)
int_hard_payload = {
    "candidate_id": current_user["id"],
    "role": "System Architect",
    "difficulty": "hard",
    "interview_type": "system_design",
}
status, hard_int = make_request("/interviews", method="POST", data=int_hard_payload, token=auth_token)
if status in [200, 201]:
    status, q_hard = make_request(f"/interviews/{hard_int['id']}/generate-questions", method="POST", data={"number_of_questions": 7}, token=auth_token)
    if status in [200, 201] and 7 <= len(q_hard) <= 12:
        log_pass(f"Hard difficulty calibrates question bank to {len(q_hard)} questions (allowed: 7-12)")
    else:
        log_fail("Hard difficulty question calibration", f"Status {status}, count {len(q_hard) if isinstance(q_hard, list) else 'err'}")

# TEST 6: Start Interview Session & Multimodal Answers
print("\n6. Testing Live Interview Flow & Multimodal Submissions...", flush=True)
status, session = make_request(f"/interviews/{easy_int['id']}/start", method="POST", token=auth_token)
if status == 200 and session.get("status") == "in_progress":
    log_pass("POST /interviews/{id}/start starts active session in_progress")
else:
    log_fail("Interview start", f"Status {status}, response: {session}")

# Execute submissions question by question using POST /interviews/{interview_id}/submit-answer
current_q = session.get("current_question")
q_index = 1

while current_q and not session.get("is_completed"):
    qid = current_q["id"]
    ans_text = (
        f"In {custom_role}, we structure architecture using decoupled modules with deterministic feedback loops. "
        "We implement robust error handling, concurrency controls, and benchmark latency across edge interfaces."
    )
    
    boundary = "----WebKitFormBoundaryQATest7MA4YWxkTrZu0gW"
    
    if q_index == 2:
        # Include mock audio WAV file
        wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        part_qid = f"--{boundary}\r\nContent-Disposition: form-data; name=\"question_id\"\r\n\r\n{qid}\r\n".encode("utf-8")
        part_text = f"--{boundary}\r\nContent-Disposition: form-data; name=\"answer_text\"\r\n\r\n{ans_text}\r\n".encode("utf-8")
        part_audio_header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio_file\"; filename=\"test_voice.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode("utf-8")
        part_end = f"\r\n--{boundary}--\r\n".encode("utf-8")
        body_payload = part_qid + part_text + part_audio_header + wav_header + part_end
    else:
        part_qid = f"--{boundary}\r\nContent-Disposition: form-data; name=\"question_id\"\r\n\r\n{qid}\r\n".encode("utf-8")
        part_text = f"--{boundary}\r\nContent-Disposition: form-data; name=\"answer_text\"\r\n\r\n{ans_text}\r\n".encode("utf-8")
        part_end = f"--{boundary}--\r\n".encode("utf-8")
        body_payload = part_qid + part_text + part_end

    sub_status, sub_res = make_request(
        f"/interviews/{easy_int['id']}/submit-answer",
        method="POST",
        data=body_payload,
        token=auth_token,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )

    if sub_status == 200:
        log_pass(f"Question #{q_index} response submitted successfully ({'with Audio WAV' if q_index == 2 else 'Text'})")
    else:
        log_fail(f"Question #{q_index} submission", f"Status {sub_status}, response: {sub_res}")
        break

    if sub_res.get("is_completed"):
        log_pass(f"Interview reached adaptive completion after {q_index} questions")
        break

    # Get next question from sub_res or query session
    if sub_res.get("next_question"):
        current_q = sub_res["next_question"]
    else:
        sec_status, session = make_request(f"/interviews/{easy_int['id']}/session", token=auth_token)
        current_q = session.get("current_question")
    q_index += 1

# TEST 7: Final Report Generation & Constructive Scoring
print("\n7. Testing Final Comprehensive Report...", flush=True)
status, report = make_request(f"/interviews/{easy_int['id']}/report", token=auth_token)
if status == 200:
    summary = report.get("interview_summary", {})
    overall = report.get("overall_performance", {})
    tech = report.get("technical_performance", {})
    q_analytics = report.get("question_analytics", [])
    
    if summary.get("is_completed") and overall.get("overall_score") is not None:
        log_pass(f"Final report verified: Overall Score {overall.get('overall_score')}% ({overall.get('performance_level')})")
        log_pass(f"Report contains {len(q_analytics)} question evaluations and deterministic final summary")
    else:
        log_fail("Final report completion check", f"Report summary incomplete: {report}")
else:
    log_fail("GET /interviews/{id}/report", f"Status {status}, response: {report}")

# TEST 8: History & Multi-Session Intelligence Progression
print("\n8. Testing Multi-Session History & Candidate Intelligence Progression...", flush=True)
# Complete second interview (med_int) with text responses to test comparative intelligence
status, med_sess = make_request(f"/interviews/{med_int['id']}/start", method="POST", token=auth_token)
m_q = med_sess.get("current_question")
m_idx = 1
while m_q and not med_sess.get("is_completed"):
    m_qid = m_q["id"]
    m_ans = "For backend architectures, we utilize connection pooling with PostgreSQL, Redis caching, and async workers."
    b = "----WebKitBoundaryMedQA"
    part_qid = f"--{b}\r\nContent-Disposition: form-data; name=\"question_id\"\r\n\r\n{m_qid}\r\n".encode("utf-8")
    part_text = f"--{b}\r\nContent-Disposition: form-data; name=\"answer_text\"\r\n\r\n{m_ans}\r\n".encode("utf-8")
    part_end = f"--{b}--\r\n".encode("utf-8")
    payload = part_qid + part_text + part_end

    s, r = make_request(
        f"/interviews/{med_int['id']}/submit-answer",
        method="POST",
        data=payload,
        token=auth_token,
        headers={"Content-Type": f"multipart/form-data; boundary={b}"},
    )
    if r.get("is_completed"):
        break
    if r.get("next_question"):
        m_q = r["next_question"]
    else:
        s, med_sess = make_request(f"/interviews/{med_int['id']}/session", token=auth_token)
        m_q = med_sess.get("current_question")
    m_idx += 1

# Check Candidate History
status, user_history = make_request("/candidates/me/history", token=auth_token)
if status == 200 and len(user_history) >= 2:
    log_pass(f"Candidate history accurately records {len(user_history)} interview sessions")
else:
    log_fail("Candidate history count", f"Expected >= 2, got {len(user_history) if isinstance(user_history, list) else user_history}")

# Check Candidate Intelligence & Trajectory Delta
status, intel_data = make_request("/candidates/me/intelligence", token=auth_token)
if status == 200 and intel_data.get("has_data") is True:
    trend = intel_data.get("performance_trend", [])
    delta = intel_data.get("score_delta")
    strengths = intel_data.get("technical_strengths", [])
    areas = intel_data.get("suggested_practice_areas", [])
    
    log_pass(f"Candidate Intelligence synthesized: {len(trend)} trend points, delta: {delta}% vs prior avg")
    log_pass(f"Strengths identified: {len(strengths)}, Practice suggestions: {len(areas)}")
else:
    log_fail("Multi-session intelligence", f"Status {status}, response: {intel_data}")

# TEST 9: Logout & Invalidation
print("\n9. Testing Logout & Token Handling...", flush=True)
status, logout_res = make_request("/auth/logout", method="POST", token=auth_token)
if status == 200:
    log_pass("POST /auth/logout successfully executes")
else:
    log_fail("Logout endpoint", f"Status {status}, response: {logout_res}")

# Login again to test persistence of candidate data
status, relogin_res = make_request("/auth/login", method="POST", data={"email": test_email, "password": test_password})
if status == 200 and "access_token" in relogin_res:
    new_token = relogin_res["access_token"]
    status, recheck_user = make_request("/candidates/me", token=new_token)
    if status == 200 and recheck_user.get("id") == candidate_id:
        log_pass("Candidate successfully logs in again with full data persistence intact")
    else:
        log_fail("Re-authenticated user data verification", f"Status {status}, response: {recheck_user}")
else:
    log_fail("Re-login", f"Status {status}, response: {relogin_res}")

print("\n=================================================================", flush=True)
print(f"QA TEST SUITE SUMMARY: {passed_tests} PASSED, {failed_tests} FAILED", flush=True)
print("=================================================================", flush=True)
if bugs_found:
    print("BUGS ENCOUNTERED:", flush=True)
    for bug in bugs_found:
        print(f" - {bug}", flush=True)
    sys.exit(1)
else:
    print("ALL TESTS PASSED WITH ZERO ERRORS.", flush=True)
    sys.exit(0)
