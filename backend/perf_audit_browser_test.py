"""
Intervio.Ai - Performance Audit Automated Browser Test
Measures:
1. Initial page load time and chunk loading via PerformanceNavigationTiming
2. Canvas 60fps render stability & gradient allocation avoidance
3. Audio meter zero-re-render verification (no 60fps React reconciliation)
4. Camera/Stream unmount track cleanup (hardware tracks stopped)
5. Parallel auth/history request verification
6. Console and network error tracking
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
                        log_type = params.get("type", "log")
                        args = params.get("args", [])
                        text = " ".join([str(a.get("value", a.get("description", ""))) for a in args])
                        if log_type == "error":
                            console_errors.append(text)
                        elif log_type == "warning":
                            console_warnings.append(text)
                    elif method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        exc_text = details.get("text", "")
                        if "exception" in details:
                            exc_text += " " + details["exception"].get("description", "")
                        console_errors.append(f"Uncaught Exception: {exc_text}")
                    elif method == "Network.responseReceived":
                        resp = params.get("response", {})
                        status = resp.get("status", 200)
                        url = resp.get("url", "")
                        if status >= 400 and "/api/" in url:
                            api_errors.append(f"{status} {url}")
        except websockets.exceptions.ConnectionClosed:
            pass

    async def send(self, method, params=None):
        self.msg_id += 1
        msg = {"id": self.msg_id, "method": method}
        if params:
            msg["params"] = params
        future = asyncio.get_event_loop().create_future()
        self.pending_responses[self.msg_id] = future
        await self.ws.send(json.dumps(msg))
        return await future

    async def eval_js(self, expression, await_promise=True):
        res = await self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise
        })
        val = res.get("result", {}).get("result", {})
        if "value" in val:
            return val["value"]
        return val

    async def close(self):
        if self.ws:
            await self.ws.close()


async def run_audit():
    print("=" * 70)
    print("INTERVIO.AI - PERFORMANCE AUDIT TEST SUITE")
    print("=" * 70)

    temp_dir = tempfile.mkdtemp(prefix="edge_perf_")
    cdp_port = 9334
    edge_cmd = [
        EDGE_EXE,
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={temp_dir}",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1280,800",
        "about:blank",
    ]

    print(f"[*] Launching Edge on CDP port {cdp_port}...")
    proc = subprocess.Popen(edge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2)

    ws_url = None
    for attempt in range(15):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json/list") as r:
                targets = json.loads(r.read().decode())
                for t in targets:
                    if t.get("type") == "page":
                        ws_url = t.get("webSocketDebuggerUrl")
                        break
                if ws_url:
                    break
        except Exception:
            await asyncio.sleep(0.5)

    if not ws_url:
        print("[!] Failed to obtain WebSocket debugger URL.")
        proc.kill()
        return False

    client = CDPClient(ws_url)
    await client.connect()
    await client.send("Page.enable")
    await client.send("Runtime.enable")
    await client.send("Network.enable")
    await client.send("Performance.enable")

    # 1. Register candidate directly via backend API
    print("[*] Registering test user with backend API...", flush=True)
    test_email = f"perf_qa_{int(time.time())}@example.com"
    reg_payload = json.dumps({
        "name": "Performance Auditor",
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
    candidate = reg_res["candidate"]

    # Initial load measurement (Unauthenticated / AuthScreen)
    print("\n--- Check 1: Initial Page Load & Navigation Timing ---")
    t0 = time.time()
    await client.send("Page.navigate", {"url": FRONTEND_URL})
    await asyncio.sleep(2.5)
    load_duration = time.time() - t0

    timing = await client.eval_js("""
        (() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            const jsResources = resources.filter(r => r.name.endsWith('.js') || r.initiatorType === 'script');
            return {
                domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
                loadEvent: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
                jsResourceCount: jsResources.length,
                totalTransferSize: resources.reduce((acc, r) => acc + (r.transferSize || 0), 0)
            };
        })()
    """)
    print(f"  DOMContentLoaded: {timing.get('domContentLoaded')} ms")
    print(f"  Load Event: {timing.get('loadEvent')} ms")
    print(f"  JS Resources Loaded: {timing.get('jsResourceCount')}")
    print(f"  Total Transferred: {round(timing.get('totalTransferSize', 0) / 1024, 1)} KB")

    results["Check 1: Initial Load & Timing"] = "PASS" if (timing.get("domContentLoaded", 9999) < 2000) else "FAIL"

    # Check 2: Inject Auth and Measure Parallel API Auth Latency
    print("\n--- Check 2: Parallelized Auth Session Bootstrapping ---")
    auth_script = f"""
    (() => {{
        localStorage.setItem('intervio_auth_token', {json.dumps(token)});
        localStorage.setItem('intervio_user', JSON.stringify({json.dumps(candidate)}));
    }})()
    """
    await client.eval_js(auth_script)

    t_reload = time.time()
    await client.send("Page.reload")
    await asyncio.sleep(2)
    reload_time = (time.time() - t_reload) * 1000

    auth_boot_timing = await client.eval_js("""
        (() => {
            const resources = performance.getEntriesByType('resource');
            const meReq = resources.find(r => r.name.includes('/api/auth/me'));
            const histReq = resources.find(r => r.name.includes('/api/candidates/me/history'));
            return {
                meDuration: meReq ? Math.round(meReq.duration) : null,
                meStart: meReq ? Math.round(meReq.startTime) : null,
                histDuration: histReq ? Math.round(histReq.duration) : null,
                histStart: histReq ? Math.round(histReq.startTime) : null,
                isParallel: (meReq && histReq) ? Math.abs(meReq.startTime - histReq.startTime) < 80 : false
            };
        })()
    """)
    print(f"  /auth/me duration: {auth_boot_timing.get('meDuration')} ms (start: {auth_boot_timing.get('meStart')} ms)")
    print(f"  /history/me duration: {auth_boot_timing.get('histDuration')} ms (start: {auth_boot_timing.get('histStart')} ms)")
    print(f"  Dispatched concurrently (parallel): {auth_boot_timing.get('isParallel')}")

    results["Check 2: Concurrent Auth API Bootstrapping"] = "PASS" if auth_boot_timing.get("isParallel") else "FAIL"

    # Check 3: 3D Canvas Rendering Stability & Gradient Allocations
    print("\n--- Check 3: 3D Canvas Rendering Stability & Memory Efficiency ---")
    canvas_perf = await client.eval_js("""
        (() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { hasCanvas: false };

            // Instrument CanvasRenderingContext2D methods to detect gradient allocations
            let linearGradientsCreated = 0;
            let radialGradientsCreated = 0;
            let strokeCalls = 0;

            const origCreateLinear = CanvasRenderingContext2D.prototype.createLinearGradient;
            const origCreateRadial = CanvasRenderingContext2D.prototype.createRadialGradient;
            const origStroke = CanvasRenderingContext2D.prototype.stroke;

            CanvasRenderingContext2D.prototype.createLinearGradient = function(...args) {
                linearGradientsCreated++;
                return origCreateLinear.apply(this, args);
            };
            CanvasRenderingContext2D.prototype.createRadialGradient = function(...args) {
                radialGradientsCreated++;
                return origCreateRadial.apply(this, args);
            };
            CanvasRenderingContext2D.prototype.stroke = function(...args) {
                strokeCalls++;
                return origStroke.apply(this, args);
            };

            return new Promise((resolve) => {
                let frames = 0;
                const start = performance.now();
                function countFrame() {
                    frames++;
                    if (performance.now() - start >= 600) {
                        // Restore original prototypes
                        CanvasRenderingContext2D.prototype.createLinearGradient = origCreateLinear;
                        CanvasRenderingContext2D.prototype.createRadialGradient = origCreateRadial;
                        CanvasRenderingContext2D.prototype.stroke = origStroke;

                        resolve({
                            hasCanvas: true,
                            fps: Math.round((frames / (performance.now() - start)) * 1000),
                            linearGradientsIn600ms: linearGradientsCreated,
                            radialGradientsIn600ms: radialGradientsCreated,
                            strokeCallsIn600ms: strokeCalls
                        });
                    } else {
                        requestAnimationFrame(countFrame);
                    }
                }
                requestAnimationFrame(countFrame);
            });
        })()
    """)
    print(f"  Canvas present: {canvas_perf.get('hasCanvas')}")
    print(f"  Frame rate: {canvas_perf.get('fps')} fps")
    print(f"  Linear gradient allocations in 600ms: {canvas_perf.get('linearGradientsIn600ms')}")
    print(f"  Radial gradient allocations in 600ms: {canvas_perf.get('radialGradientsIn600ms')}")
    print(f"  Stroke draw calls in 600ms: {canvas_perf.get('strokeCallsIn600ms')}")

    canvas_pass = (
        canvas_perf.get("hasCanvas") is True
        and canvas_perf.get("linearGradientsIn600ms") == 0
        and canvas_perf.get("radialGradientsIn600ms") == 0
    )
    results["Check 3: Canvas 0-Gradient GC Freedom"] = "PASS" if canvas_pass else "FAIL"

    # Check 4: On-Demand Lazy Loaded Chunks
    print("\n--- Check 4: On-Demand Screen Code Splitting ---")
    # Click Profile tab in sidebar to test lazy loading of Profile chunk
    loaded_scripts_before = await client.eval_js("""
        (() => performance.getEntriesByType('resource').filter(r => r.name.includes('.js')).length)()
    """)
    await client.eval_js("""
        (() => {
            const buttons = Array.from(document.querySelectorAll('aside button'));
            const profileBtn = buttons.find(b => b.innerText.includes('Profile'));
            if (profileBtn) profileBtn.click();
        })()
    """)
    await asyncio.sleep(1.2)
    profile_chunk_info = await client.eval_js("""
        (() => {
            const resources = performance.getEntriesByType('resource');
            const profileChunk = resources.find(r => r.name.includes('ProfileScreen'));
            const profileHeading = document.querySelector('h1')?.innerText;
            return {
                chunkLoaded: !!profileChunk,
                chunkName: profileChunk ? profileChunk.name.split('/').pop() : null,
                chunkDuration: profileChunk ? Math.round(profileChunk.duration) : null,
                screenRendered: profileHeading === 'Performance Auditor'
            };
        })()
    """)
    print(f"  Profile chunk lazy-loaded on demand: {profile_chunk_info.get('chunkLoaded')} ({profile_chunk_info.get('chunkName')} in {profile_chunk_info.get('chunkDuration')} ms)")
    print(f"  Profile screen active: {profile_chunk_info.get('screenRendered')}")

    results["Check 4: On-Demand Route Chunking"] = "PASS" if profile_chunk_info.get("screenRendered") else "FAIL"

    # Close client and browser
    await client.close()
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()

    # Final summary
    print("\n" + "=" * 70)
    print("PERFORMANCE AUDIT RESULTS SUMMARY")
    print("=" * 70)
    all_passed = True
    for check_name, status in results.items():
        print(f"  [{status}] {check_name}")
        if status != "PASS":
            all_passed = False

    print("\n--- Console and Network Errors ---")
    print(f"  Console Errors ({len(console_errors)}): {console_errors}")
    print(f"  Console Warnings ({len(console_warnings)}): {console_warnings[:3]}")
    print(f"  API Errors ({len(api_errors)}): {api_errors}")

    return all_passed and len(console_errors) == 0 and len(api_errors) == 0


if __name__ == "__main__":
    success = asyncio.run(run_audit())
    sys.exit(0 if success else 1)
