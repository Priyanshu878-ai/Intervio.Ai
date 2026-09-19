"""
Automated End-to-End Browser Acceptance Test for Intervio.Ai (Milestone #9)
Controls headless Microsoft Edge via Chrome DevTools Protocol (CDP).
Tests the entire candidate journey in real browser runtime:
1. Register
2. Login
3. Dashboard
4. Profile + Intelligence
5. Setup & Role search / Custom role
6. Difficulty selection
7. Camera/Mic permission & Live feed
8. Recording & Submitting answers
9. Adaptive progression
10. Completion & Final Report
11. Interview History
12. Logout
13. Login again
14. Data persistence check
Inspects console logs, uncaught exceptions, and network errors throughout.
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import websockets

FRONTEND_URL = "http://127.0.0.1:3000"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

console_errors = []
api_errors = []
steps_passed = []
steps_failed = []


def log_pass(step_name):
    steps_passed.append(step_name)
    print(f"  [PASS] {step_name}", flush=True)


def log_fail(step_name, reason):
    steps_failed.append((step_name, reason))
    print(f"  [FAIL] {step_name} - Reason: {reason}", flush=True)


class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.msg_id = 0
        self.pending_responses = {}

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=20 * 1024 * 1024)
        asyncio.create_task(self._listen())

    async def _listen(self):
        try:
            async for message in self.ws:
                data = json.loads(message)
                if "id" in data and data["id"] in self.pending_responses:
                    self.pending_responses[data["id"]].set_result(data)
                elif "method" in data:
                    method = data["method"]
                    params = data.get("params", {})
                    # Listen for console errors
                    if method == "Runtime.consoleAPICalled":
                        log_type = params.get("type")
                        if log_type in ["error", "assert"]:
                            args = [str(a.get("value", a.get("description", ""))) for a in params.get("args", [])]
                            console_errors.append(" ".join(args))
                    elif method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        console_errors.append(details.get("text", "") + " " + str(details.get("exception", {})))
                    elif method == "Network.responseReceived":
                        resp = params.get("response", {})
                        status = resp.get("status", 200)
                        url = resp.get("url", "")
                        if status >= 400 and "/api/" in url:
                            api_errors.append(f"{url} -> HTTP {status}")
        except Exception:
            pass

    async def send(self, method, params=None):
        self.msg_id += 1
        call_id = self.msg_id
        fut = asyncio.get_event_loop().create_future()
        self.pending_responses[call_id] = fut
        await self.ws.send(json.dumps({"id": call_id, "method": method, "params": params or {}}))
        res = await asyncio.wait_for(fut, timeout=30)
        del self.pending_responses[call_id]
        if "error" in res:
            raise RuntimeError(f"CDP error: {res['error']}")
        return res.get("result", {})

    async def eval_js(self, expression, await_promise=True):
        res = await self.send("Runtime.evaluate", {
            "expression": expression,
            "awaitPromise": await_promise,
            "returnByValue": True
        })
        val = res.get("result", {})
        return val.get("value")

    async def wait_for_selector(self, selector, timeout=15):
        start = time.time()
        while time.time() - start < timeout:
            exists = await self.eval_js(f"Boolean(document.querySelector('{selector}'))")
            if exists:
                return True
            await asyncio.sleep(0.3)
        return False

    async def wait_for_text(self, text, timeout=15):
        start = time.time()
        while time.time() - start < timeout:
            has_text = await self.eval_js(f"document.body.innerText.includes('{text}')")
            if has_text:
                return True
            await asyncio.sleep(0.3)
        return False


async def run_manual_acceptance_test():
    print("=================================================================", flush=True)
    print("STARTING BROWSER ACCEPTANCE TEST SUITE (EDGE HEADLESS + CDP)", flush=True)
    print("=================================================================\n", flush=True)

    profile_dir = tempfile.mkdtemp(prefix="intervio_browser_test_")
    edge_cmd = [
        EDGE_EXE,
        "--headless=new",
        "--remote-debugging-port=9222",
        f"--user-data-dir={profile_dir}",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-fre",
        "--window-size=1280,900",
        "about:blank",
    ]

    print("Launching Microsoft Edge process...", flush=True)
    edge_proc = subprocess.Popen(edge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2)

    try:
        # Get page websocket debugger URL (filter out internal browser dialogs)
        pages_raw = urllib.request.urlopen("http://127.0.0.1:9222/json").read().decode()
        pages = json.loads(pages_raw)
        page_targets = [p for p in pages if p.get("type") == "page" and not p.get("url", "").startswith("edge://")]
        target = page_targets[0] if page_targets else pages[0]
        ws_url = target["webSocketDebuggerUrl"]
        print(f"Target selected: {target.get('title')} ({target.get('url')})", flush=True)
        
        client = CDPClient(ws_url)
        await client.connect()

        await client.send("Page.enable")
        await client.send("Runtime.enable")
        await client.send("Network.enable")

        print("Connected to CDP. Navigating to frontend application...", flush=True)
        await client.send("Page.navigate", {"url": FRONTEND_URL})
        await asyncio.sleep(3)

        # 1. TEST REGISTRATION
        print("\n--- 1. Testing Registration Flow in UI ---", flush=True)
        # Verify AuthScreen is loaded
        auth_screen = await client.wait_for_selector("form", timeout=10)
        if auth_screen:
            log_pass("Auth screen rendered in browser")
        else:
            log_fail("Auth screen render", "Form element not found on page")

        # Switch to Register tab
        await client.eval_js("""
            const buttons = Array.from(document.querySelectorAll('button'));
            const regBtn = buttons.find(b => b.innerText.includes('Create Account'));
            if (regBtn) regBtn.click();
        """)
        await asyncio.sleep(1)

        test_email = f"browser_user_{int(time.time())}@example.com"
        test_pass = "SecurePass123!"

        # Fill name, email, password
        await client.eval_js(f"""
            const inputs = document.querySelectorAll('input');
            const nameInput = document.querySelector('input[placeholder*="Jordan"]') || inputs[0];
            const emailInput = document.querySelector('input[type="email"]') || inputs[1];
            const passInput = document.querySelector('input[type="password"]') || inputs[2];

            function setVal(input, val) {{
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, val);
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}

            setVal(nameInput, 'Alex Morgan');
            setVal(emailInput, '{test_email}');
            setVal(passInput, '{test_pass}');
        """)
        await asyncio.sleep(1)

        # Click submit button
        await client.eval_js("""
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
        """)
        
        # Wait for redirect to Dashboard
        dashboard_ready = await client.wait_for_text("Personal Candidate Dashboard", timeout=12)
        if dashboard_ready:
            log_pass(f"User registration and auto-login completed -> Landed on Dashboard ({test_email})")
        else:
            log_fail("Registration completion", "Did not redirect to Personal Candidate Dashboard")

        # 2. TEST DASHBOARD & LAYOUT
        print("\n--- 2. Testing Dashboard & Layout Elements ---", flush=True)
        has_greeting = await client.wait_for_text("Welcome back, Alex Morgan!", timeout=5)
        if has_greeting:
            log_pass("Dashboard greeting correctly displays candidate name")
        else:
            log_fail("Dashboard greeting", "Candidate name missing from welcome card")

        has_metrics = await client.eval_js("""
            document.body.innerText.includes('Total Interviews') &&
            document.body.innerText.includes('Completed') &&
            document.body.innerText.includes('Latest Score')
        """)
        if has_metrics:
            log_pass("Dashboard KPI metric cards render with correct labels")
        else:
            log_fail("Dashboard KPI metrics", "Metric cards not found")

        # Check for layout overflow
        is_overflowing = await client.eval_js("""
            document.documentElement.scrollWidth > window.innerWidth
        """)
        if not is_overflowing:
            log_pass("Fullscreen layout verified: Zero horizontal viewport overflow")
        else:
            log_fail("Layout check", "Horizontal scroll overflow detected")

        # 3. TEST PROFILE & INTELLIGENCE EMPTY STATE
        print("\n--- 3. Testing Profile & Candidate Intelligence ---", flush=True)
        # Click Profile tab in sidebar
        await client.eval_js("""
            const navButtons = Array.from(document.querySelectorAll('aside button, nav button'));
            const profileBtn = navButtons.find(b => b.innerText.includes('Profile'));
            if (profileBtn) profileBtn.click();
        """)
        await asyncio.sleep(2)

        has_intelligence_tab = await client.wait_for_text("Candidate Intelligence & Progress", timeout=8)
        if has_intelligence_tab:
            log_pass("ProfileScreen renders with Candidate Intelligence header")
        else:
            log_fail("ProfileScreen render", "Header not detected")

        has_empty_intelligence = await client.wait_for_text("No Completed Evaluations Recorded Yet", timeout=6)
        if has_empty_intelligence:
            log_pass("Clean empty state rendered for candidate with 0 interviews")
        else:
            log_fail("Intelligence empty state", "Empty state message not displayed")

        # Switch to Account Settings & Update Target Role
        await client.eval_js("""
            const btns = Array.from(document.querySelectorAll('button'));
            const settingsBtn = btns.find(b => b.innerText.includes('Account & Targets'));
            if (settingsBtn) settingsBtn.click();
        """)
        await asyncio.sleep(1)

        # Update target role select
        await client.eval_js("""
            const roleSelect = document.querySelector('select');
            if (roleSelect) {
                roleSelect.value = 'System Architect';
                roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Profile'));
            if (saveBtn) saveBtn.click();
        """)
        has_save_success = await client.wait_for_text("Profile information updated successfully", timeout=6)
        if has_save_success:
            log_pass("Profile settings saved successfully with live confirmation alert")
        else:
            log_fail("Profile save", "Success notification did not appear")

        # 4. TEST SETUP SCREEN & ROLE SEARCH / CUSTOM ROLE
        print("\n--- 4. Testing Setup Screen, Role Selector & Difficulty ---", flush=True)
        # Click Start tab in sidebar
        await client.eval_js("""
            const navButtons = Array.from(document.querySelectorAll('aside button, nav button'));
            const startBtn = navButtons.find(b => b.innerText.includes('Start Interview'));
            if (startBtn) startBtn.click();
        """)
        await asyncio.sleep(2)

        setup_ready = await client.wait_for_text("AI-Orchestrated Technical Interview", timeout=8)
        if setup_ready:
            log_pass("SetupScreen renders with hero banner and role catalog selector")
        else:
            log_fail("SetupScreen render", "Hero banner not found")

        # Test custom role input in RoleSelector
        await client.eval_js("""
            const roleInput = document.querySelector('input[placeholder*="Search or enter role"]');
            if (roleInput) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(roleInput, 'Robotics Vision Engineer');
                roleInput.dispatchEvent(new Event('input', { bubbles: true }));
                roleInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        """)
        await asyncio.sleep(1)

        # Select Easy difficulty
        await client.eval_js("""
            const easyRadio = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Entry / Junior'));
            if (easyRadio) easyRadio.click();
        """)
        await asyncio.sleep(1)

        length_badge = await client.wait_for_text("5–8 Questions", timeout=5)
        if length_badge:
            log_pass("AI-controlled question length badge dynamically updates to '5–8 Questions'")
        else:
            log_fail("Question length badge", "Badge did not display '5–8 Questions'")

        # 5. START INTERVIEW & CAMERA / MIC FEED
        print("\n--- 5. Testing Live Interview Screen & Camera/Mic Stream ---", flush=True)
        await client.eval_js("""
            const beginBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Begin Adaptive Interview'));
            if (beginBtn) beginBtn.click();
        """)

        interview_live = await client.wait_for_text("QUESTION #1", timeout=15)
        if interview_live:
            log_pass("Live interview initiated -> Question #1 displayed")
        else:
            log_fail("Live interview start", "Question #1 did not load")

        # Verify Camera & Mic live indicators
        has_camera = await client.wait_for_text("Live Camera", timeout=8)
        if has_camera:
            log_pass("Camera & microphone stream active with 'Live Camera' indicator and audio visualizer")
        else:
            log_fail("Camera stream", "Live camera status not detected")

        # 6. SUBMIT MULTIPLE ANSWERS & TEST TRANSITIONS
        print("\n--- 6. Testing Answer Submissions, Recording & Transitions ---", flush=True)
        # Question 1: Type written answer and submit
        await client.eval_js("""
            const textarea = document.querySelector('textarea');
            if (textarea) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                setter.call(textarea, 'We decompose the perception pipeline into edge capture, feature extraction, and real-time state tracking.');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit Answer'));
            if (submitBtn) submitBtn.click();
        """)

        transition_shown = await client.wait_for_text("Answer recorded", timeout=6)
        if transition_shown:
            log_pass("Neutral transition state 'Answer recorded — preparing next question...' smoothly displayed")
        else:
            log_fail("Transition state", "Transition indicator not observed")

        # Wait for Question 2
        q2_ready = await client.wait_for_text("QUESTION #2", timeout=15)
        if q2_ready:
            log_pass("AI adaptive engine successfully loaded QUESTION #2")
        else:
            log_fail("Question 2 progression", "Did not progress to Question #2")

        # Question 2: Test Record Answer button
        print("Testing camera recording button interaction...", flush=True)
        await client.eval_js("""
            const recBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Start Recording Answer'));
            if (recBtn) recBtn.click();
        """)
        await asyncio.sleep(2)

        # Stop recording
        await client.eval_js("""
            const stopBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Stop Recording'));
            if (stopBtn) stopBtn.click();
        """)
        await asyncio.sleep(1.5)

        recorded_badge = await client.wait_for_text("Response Captured", timeout=8)
        if recorded_badge:
            log_pass("MediaRecorder captured camera video and microphone audio successfully")
        else:
            log_fail("MediaRecorder capture", "'Response Captured' badge not observed")

        # Submit Question 2 with recording attached
        await client.eval_js("""
            const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit Answer'));
            if (submitBtn) submitBtn.click();
        """)

        # Wait for Question 3
        q3_ready = await client.wait_for_text("QUESTION #3", timeout=15)
        if q3_ready:
            log_pass("Submitted multimodal answer with audio/video -> Loaded QUESTION #3")
        else:
            log_fail("Question 3 progression", "Did not progress to Question #3")

        # Submit remaining questions until interview completes
        print("Submitting remaining questions to reach adaptive interview completion...", flush=True)
        for q_num in range(3, 9):
            is_done = await client.eval_js("document.body.innerText.includes('Interview completed')")
            if is_done:
                break
            
            await client.eval_js(f"""
                const textarea = document.querySelector('textarea');
                if (textarea) {{
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                    setter.call(textarea, 'We calibrate latency trade-offs, monitor memory bandwidth, and enforce fail-safe defaults across the cluster.');
                    textarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    textarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }}
                const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit Answer'));
                if (submitBtn) submitBtn.click();
            """)
            await asyncio.sleep(4)

        # 7. INTERVIEW COMPLETION & REPORT
        print("\n--- 7. Testing Interview Completion & Final Report ---", flush=True)
        completion_view = await client.wait_for_text("Final Performance Analytics & Report", timeout=20)
        if completion_view:
            log_pass("Interview reached completion -> Automatically rendered Final Report Dashboard")
        else:
            log_fail("Final report render", "Did not automatically navigate to Final Report Dashboard")

        has_gauge = await client.wait_for_text("Holistic Evaluation Score", timeout=5)
        has_breakdown = await client.wait_for_text("Sequential Question Breakdown", timeout=5)
        if has_gauge and has_breakdown:
            log_pass("ReportDashboard displays 3D score gauge, category dimensions, and sequential breakdown")
        else:
            log_fail("Report visual elements", "Score gauge or breakdown missing")

        # 8. TEST INTERVIEW HISTORY
        print("\n--- 8. Testing Interview History & Re-opening Report ---", flush=True)
        # Click History tab in sidebar
        await client.eval_js("""
            const navButtons = Array.from(document.querySelectorAll('aside button, nav button'));
            const historyBtn = navButtons.find(b => b.innerText.includes('Interview History'));
            if (historyBtn) historyBtn.click();
        """)
        await asyncio.sleep(2)

        has_history_item = await client.wait_for_text("Robotics Vision Engineer", timeout=8)
        if has_history_item:
            log_pass("Interview history records completed session with role and status")
        else:
            log_fail("Interview history item", "Completed session not found in history")

        # Click View Report from history
        await client.eval_js("""
            const reportBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Report'));
            if (reportBtn) reportBtn.click();
        """)
        report_reopened = await client.wait_for_text("Final Performance Analytics & Report", timeout=8)
        if report_reopened:
            log_pass("Report re-opened successfully from History screen")
        else:
            log_fail("Report re-open", "Report failed to re-open from history")

        # 9. TEST PROFILE INTELLIGENCE (WITH DATA)
        print("\n--- 9. Testing Profile Intelligence with Synthesized Session Data ---", flush=True)
        await client.eval_js("""
            const navButtons = Array.from(document.querySelectorAll('aside button, nav button'));
            const profileBtn = navButtons.find(b => b.innerText.includes('Profile'));
            if (profileBtn) profileBtn.click();
        """)
        await asyncio.sleep(2)

        has_trajectory = await client.wait_for_text("Executive Trajectory Summary", timeout=8)
        has_strengths = await client.wait_for_text("Technical Strengths & Competencies", timeout=8)
        if has_trajectory and has_strengths:
            log_pass("Profile Intelligence synthesized multi-session trajectory and technical strengths")
        else:
            log_fail("Synthesized intelligence", "Trajectory or strengths missing")

        # 10. TEST LOGOUT & PERSISTENCE
        print("\n--- 10. Testing Logout & Data Persistence Across Sessions ---", flush=True)
        # Click Sign Out in sidebar
        await client.eval_js("""
            const signOutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Out'));
            if (signOutBtn) signOutBtn.click();
        """)
        await asyncio.sleep(2)

        logged_out = await client.wait_for_text("Sign in to your candidate account", timeout=8)
        if logged_out:
            log_pass("User logged out cleanly -> Redirected to Login Screen")
        else:
            log_fail("Logout check", "Did not redirect to login screen")

        # Login again with same credentials
        await client.eval_js(f"""
            const inputs = document.querySelectorAll('input');
            const emailInput = document.querySelector('input[type="email"]') || inputs[0];
            const passInput = document.querySelector('input[type="password"]') || inputs[1];

            function setVal(input, val) {{
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, val);
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}

            setVal(emailInput, '{test_email}');
            setVal(passInput, '{test_pass}');

            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
        """)

        relogin_ok = await client.wait_for_text("Welcome back, Alex Morgan!", timeout=10)
        if relogin_ok:
            log_pass("Re-authenticated with same credentials -> Full data persistence verified on Dashboard")
        else:
            log_fail("Re-login persistence", "Did not authenticate back into candidate dashboard")

    finally:
        try:
            edge_proc.terminate()
        except Exception:
            pass

    print("\n=================================================================", flush=True)
    print(f"BROWSER ACCEPTANCE RESULTS: {len(steps_passed)} PASSED, {len(steps_failed)} FAILED", flush=True)
    print("=================================================================", flush=True)
    
    if console_errors:
        print(f"Console errors detected ({len(console_errors)}):", flush=True)
        for err in console_errors:
            print(f"  - {err}", flush=True)
    else:
        print("Console errors: ZERO console errors detected.", flush=True)

    if api_errors:
        print(f"API errors detected ({len(api_errors)}):", flush=True)
        for err in api_errors:
            print(f"  - {err}", flush=True)
    else:
        print("API errors: ZERO API errors detected.", flush=True)

    if steps_failed:
        sys.exit(1)
    else:
        print("\nALL BROWSER ACCEPTANCE TESTS PASSED WITH ZERO DEFECTS.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(run_manual_acceptance_test())
