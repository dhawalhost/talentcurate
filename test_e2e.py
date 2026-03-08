import asyncio
import websockets
import aiohttp
import json
import time

async def test_e2e():
    print("🚀 Starting Spinvel Backend E2E Test")
    
    async with aiohttp.ClientSession() as session:
        # 1. Create Interview Session
        print("\n1. Creating Session...")
        payload = {
            "title": "E2E Test Session",
            "interviewer_id": "test_int",
            "candidate_email": "e2e@spinvel.com",
            "language_preset": "python3"
        }
        async with session.post("http://localhost:8080/api/v1/sessions", json=payload) as resp:
            data = await resp.json()
            session_id = data["session_id"]
            print(f"✅ Session Created: {session_id}")

        # 2. Connect WebSocket
        print("\n2. Connecting WebSocket...")
        ws_url = f"ws://localhost:8080/collab/{session_id}?token=test"
        
        async with websockets.connect(ws_url) as ws:
            print("✅ WebSocket Connected!")

            # Start listening for the execution result
            async def listen_for_result():
                print("   Listening for WS broadcasts...")
                while True:
                    msg = await ws.recv()
                    print(f"   [WS message received]: {msg}")
                    try:
                        parsed = json.loads(msg)
                        if parsed.get("type") == "EXEC_COMPLETED":
                            print(f"\n✅ Final Execution Result Received:\n{json.dumps(parsed, indent=2)}")
                            return True
                    except:
                        pass
            
            listener_task = asyncio.create_task(listen_for_result())

            # 3. Trigger Code Execution
            print("\n3. Triggering Code Execution (via API Gateway)...")
            code_payload = {
                "language": "python3",
                "source_code": "def solve():\n    print('Hello from the Sandbox!')\n    return 42\n\nsolve()",
                "test_cases": []
            }
            exec_url = f"http://localhost:8080/api/v1/sessions/{session_id}/execute"
            async with session.post(exec_url, json=code_payload) as exec_resp:
                exec_data = await exec_resp.json()
                print(f"✅ Execution Job Queued: {exec_data['execution_id']}")

            # Wait for execution result to come back over WS
            try:
                await asyncio.wait_for(listener_task, timeout=10.0)
            except asyncio.TimeoutError:
                print("❌ Timed out waiting for execution result.")

if __name__ == "__main__":
    asyncio.run(test_e2e())
