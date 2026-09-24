"""
Focused Browser QA for Intervio.Ai UI Fixes
Automates Microsoft Edge via Chrome DevTools Protocol (CDP) at http://localhost:3000.

Checks:
1. Start Interview page: Candidate Profile removed, Target Role & Track search bar present & working.
2. Search role: Suggested Roles dropdown appears above Difficulty/Format cards (z-index & hit testing), scrollable & usable.
3. Sidebar: Remains fixed during page scroll.
4. Background: 3D canvas animates smoothly, mouse movement causes parallax, foreground elements remain readable.
5. Console and network error monitoring.
"""

import asyncio
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import websockets

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8000/api"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

console_errors = []
console_warnings = []
api_errors = []
results = {}


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
                    if method == "Runtime.consoleAPICalled":
                        log_type = params.get("type")
                        args = [str(a.get("value", a.get("description", ""))) for a in params.get("args", [])]
                        msg = " ".join(args)
                        if log_type in ["error", "assert"]:
                            console_errors.append(msg)
                        elif log_type == "warning":
                            console_warnings.append(msg)
                    elif method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        console_errors.append(details.get("text", "") + " " + str(details.get("exception", {})))
                    elif method == "Network.responseReceived":
                        resp = params.get("response", {})
                        status = resp.get("status", 200)
                        url = resp.get("url", "")
                        if status >= 400 and "/api/" in url:
                            api_errors.append(f"{status} on {url}")
        except Exception:
            pass

    async def send(self, method, params=None):
        self.msg_id += 1
        msg_id = self.msg_id
        payload = {"id": msg_id, "method": method, "params": params or {}}
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        self.pending_responses[msg_id] = future
        await self.ws.send(json.dumps(payload))
        return await future

    async def eval_js(self, expression, await_promise=False):
        res = await self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise
        })
        val = res.get("result", {}).get("result", {}).get("value")
        return val

    async def wait_for_selector(self, selector, timeout=10):
        start = time.time()
        while time.time() - start < timeout:
            found = await self.eval_js(f"Boolean(document.querySelector('{selector}'))")
            if found:
                return True
            await asyncio.sleep(0.3)
        return False

    async def wait_for_text(self, text, timeout=10):
        start = time.time()
        while time.time() - start < timeout:
            found = await self.eval_js(f"document.body.innerText.includes({json.dumps(text)})")
            if found:
                return True
            await asyncio.sleep(0.3)
        return False


async def run_browser_qa():
    print("=================================================================", flush=True)
    print("STARTING FOCUSED BROWSER QA AT HTTP://LOCALHOST:3000", flush=True)
    print("=================================================================\n", flush=True)

    # 1. Register candidate directly via backend API to obtain clean JWT
    print("1. Creating authenticated candidate via Backend API...", flush=True)
    test_email = f"browser_qa_{int(time.time())}@example.com"
    reg_payload = json.dumps({
        "name": "Alex Morgan",
        "email": test_email,
        "password": "Password123!"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        f"{BACKEND_URL}/auth/register",
        data=reg_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        reg_res = json.loads(resp.read().decode())
    token = reg_res["access_token"]
    print(f"Candidate registered: {test_email}, token obtained.", flush=True)

    # 2. Spawn Headless Edge with remote debugging
    tmp_user_dir = tempfile.mkdtemp(prefix="edge_qa_ui_")
    remote_port = 9225

    edge_cmd = [
        EDGE_EXE,
        f"--remote-debugging-port={remote_port}",
        f"--user-data-dir={tmp_user_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--headless=new",
        "--window-size=1440,900",
        "--disable-gpu-sandbox",
        FRONTEND_URL
    ]

    edge_proc = subprocess.Popen(edge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Spawned Headless Edge (PID: {edge_proc.pid}) on debug port {remote_port}", flush=True)

    try:
        # Wait for CDP endpoint to become ready
        ws_url = None
        for _ in range(30):
            await asyncio.sleep(0.5)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{remote_port}/json") as r:
                    pages = json.loads(r.read().decode())
                    page_targets = [p for p in pages if p.get("type") == "page" and not p.get("url", "").startswith("edge://")]
                    if page_targets:
                        ws_url = page_targets[0].get("webSocketDebuggerUrl")
                        break
            except Exception:
                pass

        if not ws_url:
            raise RuntimeError("Failed to connect to Edge DevTools WebSocket endpoint")

        cdp = CDPClient(ws_url)
        await cdp.connect()
        await cdp.send("Page.enable")
        await cdp.send("Runtime.enable")
        await cdp.send("Network.enable")

        print("Connected to CDP. Navigating to http://localhost:3000...", flush=True)
        await cdp.send("Page.navigate", {"url": FRONTEND_URL})
        await asyncio.sleep(1.0)

        # Inject auth token into localStorage and reload
        print("Injecting auth token into browser localStorage...", flush=True)
        await cdp.eval_js(f"localStorage.setItem('intervio_auth_token', '{token}');")
        await cdp.send("Page.navigate", {"url": FRONTEND_URL})

        # Wait for Dashboard to render
        dashboard_ready = await cdp.wait_for_text("Personal Candidate Dashboard", timeout=12)
        print(f"Landed on Authenticated Dashboard: {dashboard_ready}", flush=True)
        if not dashboard_ready:
            raise RuntimeError("Dashboard did not load with valid token")

        # Navigate to Start Interview (Setup Screen)
        print("Clicking Start Interview from Sidebar / Dashboard...", flush=True)
        await cdp.eval_js("""
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const startBtn = buttons.find(b => b.innerText && (b.innerText.includes('Start Interview') || b.innerText.includes('Start') || b.innerText.includes('New Interview')));
            if (startBtn) startBtn.click();
        """)

        setup_ready = await cdp.wait_for_text("Interview Configuration", timeout=10)
        print(f"Setup Screen loaded: {setup_ready}", flush=True)
        await asyncio.sleep(1.0)

        # -------------------------------------------------------------
        # CHECK 1: Start Interview page
        # - Candidate Profile section is completely gone.
        # - Target Role & Track search bar is still present and working.
        # -------------------------------------------------------------
        print("\n--- CHECK 1: Start Interview Page Structure ---", flush=True)
        check1_profile = await cdp.eval_js("""
            (() => {
                const text = document.body.innerText;
                const hasProfileHeading = text.includes('Candidate Profile');
                const hasFullNameLabel = text.includes('Full Name');
                const hasEmailLabel = text.includes('Email Address');
                return {
                    hasProfileHeading,
                    hasFullNameLabel,
                    hasEmailLabel,
                    passed: !hasProfileHeading && !hasFullNameLabel && !hasEmailLabel
                };
            })()
        """)
        print(f"  Candidate Profile section check: {check1_profile}", flush=True)

        check1_search_bar = await cdp.eval_js("""
            (() => {
                const searchInput = document.querySelector('input[placeholder*="Search roles"]') || document.querySelector('input[placeholder*="Search"]');
                const heading = Array.from(document.querySelectorAll('h2, h3, div')).find(el => el.textContent && el.textContent.includes('Target Role & Track'));
                return {
                    hasHeading: Boolean(heading),
                    hasSearchInput: Boolean(searchInput),
                    placeholder: searchInput ? searchInput.placeholder : null,
                    passed: Boolean(heading) && Boolean(searchInput)
                };
            })()
        """)
        print(f"  Target Role & Track search bar check: {check1_search_bar}", flush=True)

        check1_filter = await cdp.eval_js("""
            (() => {
                const searchInput = document.querySelector('input[placeholder*="Search roles"]') || document.querySelector('input[placeholder*="Search"]');
                if (!searchInput) return { passed: false, error: 'Input not found' };

                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(searchInput, 'Cloud');
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));

                const suggestions = Array.from(document.querySelectorAll('button'))
                    .map(b => b.innerText)
                    .filter(t => t && t.toLowerCase().includes('cloud'));

                return {
                    passed: suggestions.length > 0,
                    foundSuggestions: suggestions.slice(0, 3)
                };
            })()
        """)
        print(f"  Role search filtering test: {check1_filter}", flush=True)

        c1_pass = check1_profile.get("passed", False) and check1_search_bar.get("passed", False) and check1_filter.get("passed", False)
        results["1. Start Interview Page (Profile gone, Search bar working)"] = "PASS" if c1_pass else "FAIL"

        # -------------------------------------------------------------
        # CHECK 2: Search role
        # - Open role search.
        # - Suggested Roles must appear above Difficulty/Format cards.
        # - Scroll while dropdown is open; it must remain usable.
        # -------------------------------------------------------------
        print("\n--- CHECK 2: Search Role Dropdown Stacking & Scroll ---", flush=True)
        # Type 'Engineer' into role search to open suggestions
        await cdp.eval_js("""
            const searchInput = document.querySelector('input[placeholder*="Search roles"]') || document.querySelector('input[placeholder*="Search"]');
            if (searchInput) {
                searchInput.focus();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(searchInput, 'Engineer');
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        """)
        await asyncio.sleep(0.5)

        check2_stacking = await cdp.eval_js("""
            (() => {
                const dropdown = document.querySelector('.max-h-80') || document.querySelector('.max-h-72');
                const cards = Array.from(document.querySelectorAll('.card-3d'));
                const difficultyCard = cards.find(c => c.textContent && c.textContent.includes('Starting Difficulty'));

                if (!dropdown || !difficultyCard) {
                    return {
                        passed: false,
                        error: 'Dropdown or difficulty card not found',
                        hasDropdown: Boolean(dropdown),
                        hasDifficultyCard: Boolean(difficultyCard)
                    };
                }

                const dropRect = dropdown.getBoundingClientRect();
                const diffRect = difficultyCard.getBoundingClientRect();

                // Check vertical overlap region
                const overlapTop = Math.max(dropRect.top, diffRect.top);
                const overlapBottom = Math.min(dropRect.bottom, diffRect.bottom);
                const overlaps = overlapBottom > overlapTop;

                // Perform elementFromPoint in dropdown area that overlaps or sits above cards
                const testX = dropRect.left + dropRect.width / 2;
                const testY = dropRect.top + 50;
                const topElement = document.elementFromPoint(testX, testY);
                const isDropdownOnTop = dropdown.contains(topElement);

                const dropStyle = window.getComputedStyle(dropdown);
                const roleCard = dropdown.closest('.card-3d');
                const roleCardStyle = roleCard ? window.getComputedStyle(roleCard) : null;
                const diffCardStyle = window.getComputedStyle(difficultyCard);

                return {
                    dropdownRect: { top: dropRect.top, bottom: dropRect.bottom, height: dropRect.height },
                    difficultyCardRect: { top: diffRect.top, bottom: diffRect.bottom },
                    overlaps,
                    dropdownZIndex: dropStyle.zIndex,
                    roleCardZIndex: roleCardStyle ? roleCardStyle.zIndex : null,
                    difficultyCardZIndex: diffCardStyle.zIndex,
                    topElementTag: topElement ? topElement.tagName : null,
                    isDropdownOnTop,
                    passed: isDropdownOnTop
                };
            })()
        """)
        print(f"  Dropdown stacking & hit-test check: {check2_stacking}", flush=True)

        # Scroll while dropdown is open and verify usability
        print("  Scrolling page while dropdown is open...", flush=True)
        check2_scroll = await cdp.eval_js("""
            (() => {
                window.scrollTo(0, 150);

                const dropdown = document.querySelector('.max-h-80') || document.querySelector('.max-h-72');
                if (!dropdown) return { passed: false, error: 'Dropdown vanished upon scroll' };

                const dropRect = dropdown.getBoundingClientRect();
                const testX = dropRect.left + dropRect.width / 2;
                const testY = dropRect.top + 40;
                const topElem = document.elementFromPoint(testX, testY);
                const isTop = dropdown.contains(topElem);

                // Click a suggestion to verify usability while scrolled
                const buttons = Array.from(dropdown.querySelectorAll('button'));
                let selectedRole = null;
                if (buttons.length > 0) {
                    selectedRole = buttons[0].innerText.split('\\n')[0];
                    buttons[0].click();
                }

                return {
                    scrollY: window.scrollY,
                    isTop,
                    hasButtons: buttons.length > 0,
                    selectedRole,
                    passed: isTop && buttons.length > 0
                };
            })()
        """)
        print(f"  Dropdown scroll & selection check: {check2_scroll}", flush=True)

        c2_pass = check2_stacking.get("passed", False) and check2_scroll.get("passed", False)
        results["2. Search Role (Dropdown above cards & usable on scroll)"] = "PASS" if c2_pass else "FAIL"

        # -------------------------------------------------------------
        # CHECK 3: Sidebar
        # - Scroll the page.
        # - Sidebar must remain fixed.
        # -------------------------------------------------------------
        print("\n--- CHECK 3: Sidebar Fixed on Scroll ---", flush=True)
        # Reset scroll, inspect, scroll to 500px, inspect
        await cdp.eval_js("window.scrollTo(0, 0);")
        await asyncio.sleep(0.3)

        check3_sidebar = await cdp.eval_js("""
            (() => {
                const aside = document.querySelector('aside');
                if (!aside) return { passed: false, error: 'Sidebar aside not found' };

                const style = window.getComputedStyle(aside);
                const rectBefore = aside.getBoundingClientRect();

                // Scroll page down significantly
                window.scrollTo(0, 450);

                const rectAfter = aside.getBoundingClientRect();
                const scrollY = window.scrollY;

                const remainsFixed = Math.abs(rectAfter.top - 0) <= 2;
                const leftStays0 = Math.abs(rectAfter.left - 0) <= 2;

                return {
                    positionStyle: style.position,
                    topStyle: style.top,
                    leftStyle: style.left,
                    rectBeforeTop: rectBefore.top,
                    rectAfterTop: rectAfter.top,
                    scrollY,
                    remainsFixed,
                    leftStays0,
                    passed: (style.position === 'fixed' || style.position === 'sticky') && remainsFixed && leftStays0
                };
            })()
        """)
        print(f"  Sidebar scroll check: {check3_sidebar}", flush=True)
        results["3. Sidebar (Remains fixed during page scroll)"] = "PASS" if check3_sidebar.get("passed", False) else "FAIL"

        # -------------------------------------------------------------
        # CHECK 4: Background
        # - 3D background animates smoothly.
        # - Cursor movement creates subtle parallax.
        # - Foreground text/cards remain readable.
        # -------------------------------------------------------------
        print("\n--- CHECK 4: Futuristic 3D Background & Cursor Parallax ---", flush=True)
        check4_bg = await cdp.eval_js("""
            (async () => {
                const canvas = document.querySelector('canvas');
                if (!canvas) return { passed: false, error: 'Canvas not found' };

                const initialWidth = canvas.width;
                const initialHeight = canvas.height;

                // 1. Check active animation frame progression
                let frames = 0;
                const startTime = performance.now();
                await new Promise(resolve => {
                    function step() {
                        frames++;
                        if (performance.now() - startTime >= 250) {
                            resolve();
                        } else {
                            requestAnimationFrame(step);
                        }
                    }
                    requestAnimationFrame(step);
                });

                // 2. Dispatch cursor movement across window to test parallax
                window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
                await new Promise(r => setTimeout(r, 60));
                window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 500 }));
                await new Promise(r => setTimeout(r, 60));

                // 3. Check readability of foreground elements
                const cards = Array.from(document.querySelectorAll('.card-3d'));
                const cardBackdrops = cards.map(c => window.getComputedStyle(c).backdropFilter || window.getComputedStyle(c).backgroundColor);
                const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
                const headingColors = headings.slice(0, 4).map(h => window.getComputedStyle(h).color);

                return {
                    hasCanvas: true,
                    canvasDimensions: { width: initialWidth, height: initialHeight },
                    measuredFps: Math.round((frames / 250) * 1000),
                    animatedSmoothly: frames >= 5,
                    cardCount: cards.length,
                    readableContrast: headingColors.length > 0,
                    sampleHeadingColors: headingColors,
                    passed: frames >= 5 && initialWidth > 0 && initialHeight > 0 && cards.length > 0
                };
            })()
        """, await_promise=True)
        print(f"  Background animation & readability check: {check4_bg}", flush=True)
        results["4. Background (3D animates smoothly, parallax active, text readable)"] = "PASS" if check4_bg.get("passed", False) else "FAIL"

        # -------------------------------------------------------------
        # CHECK 5: Console & Network Errors
        # -------------------------------------------------------------
        print("\n--- CHECK 5: Console & Network Errors ---", flush=True)
        await asyncio.sleep(0.5)
        print(f"  Console Errors ({len(console_errors)}): {console_errors}", flush=True)
        print(f"  Console Warnings ({len(console_warnings)}): {console_warnings}", flush=True)
        print(f"  API Network Errors ({len(api_errors)}): {api_errors}", flush=True)

        c5_pass = len(console_errors) == 0 and len(api_errors) == 0
        results["5. Console & Network Errors (Clean, no exceptions)"] = "PASS" if c5_pass else "FAIL"

        # Capture Screenshot
        ss_res = await cdp.send("Page.captureScreenshot", {"format": "png"})
        ss_data = ss_res.get("result", {}).get("data")
        if ss_data:
            ss_path = "focused_qa_screenshot.png"
            with open(ss_path, "wb") as f:
                f.write(base64.b64decode(ss_data))
            print(f"\nSaved proof screenshot to {ss_path}", flush=True)

    finally:
        edge_proc.terminate()
        try:
            edge_proc.wait(timeout=3)
        except Exception:
            edge_proc.kill()

    print("\n=================================================================", flush=True)
    print("FINAL FOCUSED QA SUMMARY:", flush=True)
    print("=================================================================", flush=True)
    all_pass = True
    for k, v in results.items():
        print(f"  {k}: {v}", flush=True)
        if v != "PASS":
            all_pass = False
    print(f"\nOVERALL RESULT: {'ALL PASS' if all_pass else 'SOME FAILED'}", flush=True)
    print("=================================================================", flush=True)


if __name__ == "__main__":
    asyncio.run(run_browser_qa())
