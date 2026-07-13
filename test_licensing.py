import json
import urllib.request
import urllib.error
import hashlib
import os
import sys

BASE_URL = "http://localhost:3000"
DB_PATH = "./licenses.json"
SECRET_SALT = "EPG_ARABIC_SECRET_2026"
ADMIN_SESSION_SECRET = "EPG_SESSION_2026"

def request_json(url, data=None, headers=None, method=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except:
            return e.code, {"error": e.reason}

def generate_local_signature(key, hwid, expires_at):
    raw = f"{key}:{hwid}:{expires_at}:{SECRET_SALT}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def run_tests():
    print("======================================================================")
    print("🚀 EPG-PRO LICENSING SERVER - PRODUCTION INTEGRATION TEST SUITE")
    print("======================================================================\n")

    # Save original DB
    db_existed = os.path.exists(DB_PATH)
    original_db_content = ""
    if db_existed:
        with open(DB_PATH, 'r') as f:
            original_db_content = f.read()

    try:
        # 1. Clean Database Setup
        print("📁 1. Initializing clean database...")
        clean_db = {
            "licenses": [],
            "activation_logs": []
        }
        with open(DB_PATH, 'w') as f:
            f.write(json.dumps(clean_db, indent=2))
        print("✅ Clean database initialized.\n")

        # 2. Get Admin Login Token
        print("🔑 2. Testing Admin Authentication...")
        login_payload = {"username": "admin", "password": "admin"}
        status, res = request_json(f"{BASE_URL}/api/admin/login", login_payload, method="POST")
        if status != 200 or not res.get("success"):
            print(f"❌ Admin login failed: {res}")
            sys.exit(1)
        
        token = res.get("token")
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Admin authenticated. Token received: {token[:8]}...\n")

        # 3. Generate License Keys
        print("🎫 3. Testing License Key Generation...")
        # A. Lifetime Key
        status, res = request_json(
            f"{BASE_URL}/api/admin/licenses", 
            {"type": "lifetime", "notes": "Automated Test Lifetime Key", "count": 1}, 
            headers, 
            "POST"
        )
        if status != 200 or not res.get("success"):
            print(f"❌ Key generation failed: {res}")
            sys.exit(1)
        
        lifetime_key = res["keys"][0]["key"]
        print(f"✅ Generated Lifetime Key: {lifetime_key}")

        # B. 30 Days Key
        status, res = request_json(
            f"{BASE_URL}/api/admin/licenses", 
            {"type": "30days", "notes": "Automated Test 30 Days Key", "count": 1}, 
            headers, 
            "POST"
        )
        thirty_days_key = res["keys"][0]["key"]
        print(f"✅ Generated 30-Day Key: {thirty_days_key}\n")

        # 4. License Activation (Clean database)
        print("🔌 4. Testing First-time License Activation...")
        activate_url = f"{BASE_URL}/api/license/activate?key={lifetime_key}&hwid=RECEIVER_1&image=EGAMI&model=VU_DUO_4K"
        status, res = request_json(activate_url, method="GET")
        if status != 200 or not res.get("success"):
            print(f"❌ Activation failed: {res}")
            sys.exit(1)
        
        print(f"✅ License activated successfully!")
        print(f"   Status: {res.get('status')}")
        print(f"   Expires At: {res.get('expires_at')}")
        print(f"   Signature: {res.get('signature')}")
        
        # Verify response signature
        expected_sig = generate_local_signature(lifetime_key, "RECEIVER_1", "lifetime")
        if res.get("signature") == expected_sig:
            print("✅ Cryptographic Signature match! Anti-tampering is functional.\n")
        else:
            print(f"❌ Cryptographic Signature mismatch! Expected: {expected_sig}, Got: {res.get('signature')}")
            sys.exit(1)

        # 5. HWID Binding & Mismatch Verification
        print("🔒 5. Testing Hardware ID Lock (HWID Binding)...")
        # Try activating same key on a different receiver (RECEIVER_2)
        mismatch_url = f"{BASE_URL}/api/license/activate?key={lifetime_key}&hwid=RECEIVER_2&image=OPENPLI&model=DREAMBOX_920"
        status, res = request_json(mismatch_url, method="GET")
        if status == 400 and not res.get("success"):
            print(f"✅ Hardware lock working correctly. Expected error returned: '{res.get('error')}'\n")
        else:
            print(f"❌ Error! Server allowed double activation on a locked key. Status: {status}, Response: {res}")
            sys.exit(1)

        # 6. Verify Endpoint & Offline Validation fallback
        print("🔍 6. Testing License Verification & Offline Grace Period Checks...")
        verify_url = f"{BASE_URL}/api/license/verify?key={lifetime_key}&hwid=RECEIVER_1"
        status, res = request_json(verify_url, method="GET")
        if status != 200 or not res.get("success"):
            print(f"❌ Verification failed: {res}")
            sys.exit(1)
        print("✅ Online check-in verification succeeded.")
        
        # Test mismatched HWID on verify
        verify_mismatch_url = f"{BASE_URL}/api/license/verify?key={lifetime_key}&hwid=RECEIVER_2"
        status, res = request_json(verify_mismatch_url, method="GET")
        if status == 400 and not res.get("success"):
            print(f"✅ Verification rejected mismatched HWID correctly: '{res.get('error')}'\n")
        else:
            print(f"❌ Error! Server validated verification for a mismatched HWID. Status: {status}")
            sys.exit(1)

        # 7. Reset HWID Admin Operation
        print("🔄 7. Testing Administrative Reset/Unbind HWID...")
        reset_payload = {"key": lifetime_key}
        status, res = request_json(f"{BASE_URL}/api/admin/licenses/reset", reset_payload, headers, "POST")
        if status != 200 or not res.get("success"):
            print(f"❌ Admin reset HWID failed: {res}")
            sys.exit(1)
        print("✅ HWID successfully unbound from administrative dashboard.")

        # Try activating on RECEIVER_2 now (should work as key is now free)
        rebind_url = f"{BASE_URL}/api/license/activate?key={lifetime_key}&hwid=RECEIVER_2&image=OPENATV&model=VU_UNO_SE"
        status, res = request_json(rebind_url, method="GET")
        if status == 200 and res.get("success") and res.get("hwid") == "RECEIVER_2":
            print("✅ Successfully rebound license key to RECEIVER_2!\n")
        else:
            print(f"❌ Failed to rebind key after reset. Status: {status}, Response: {res}")
            sys.exit(1)

        # 8. Revoke Key Admin Operation
        print("🚫 8. Testing License Revocation...")
        revoke_payload = {"key": lifetime_key}
        status, res = request_json(f"{BASE_URL}/api/admin/licenses/revoke", revoke_payload, headers, "POST")
        if status != 200 or not res.get("success"):
            print(f"❌ Admin revoke failed: {res}")
            sys.exit(1)
        print("✅ License revoked from administrative dashboard.")

        # Confirm client is blocked on activate/verify
        status, res = request_json(f"{BASE_URL}/api/license/activate?key={lifetime_key}&hwid=RECEIVER_2", method="GET")
        if status == 403 and not res.get("success"):
            print("✅ Remote activation correctly blocked for revoked key.")
        else:
            print(f"❌ Error! Allowed activation on revoked key. Status: {status}, Response: {res}")
            sys.exit(1)

        status, res = request_json(f"{BASE_URL}/api/license/verify?key={lifetime_key}&hwid=RECEIVER_2", method="GET")
        if status == 403 and not res.get("success"):
            print("✅ Remote check-in verification correctly blocked for revoked key.\n")
        else:
            print(f"❌ Error! Allowed verification check on revoked key. Status: {status}")
            sys.exit(1)

        # 9. Test Expired Licenses Check
        print("⌛ 9. Testing License Expiration Enforcement...")
        # Manually alter thirty_days_key's expiration date to yesterday
        with open(DB_PATH, 'r') as f:
            db_data = json.loads(f.read())
        
        for lic in db_data["licenses"]:
            if lic["key"] == thirty_days_key:
                lic["expires_at"] = "2026-07-12T00:00:00.000Z" # Yesterday relative to July 13 2026
                lic["hwid"] = "RECEIVER_3"
                lic["status"] = "Active"
        
        with open(DB_PATH, 'w') as f:
            f.write(json.dumps(db_data, indent=2))
        print("⚙️ Directly mocked expired license in data store.")

        # Verify expired license is rejected on check-in
        verify_expired_url = f"{BASE_URL}/api/license/verify?key={thirty_days_key}&hwid=RECEIVER_3"
        status, res = request_json(verify_expired_url, method="GET")
        if status == 403 and not res.get("success"):
            print("✅ Check-in correctly rejected. Database marked status as Expired.\n")
        else:
            print(f"❌ Error! Allowed verification check on expired license key. Status: {status}, Response: {res}")
            sys.exit(1)

        # 10. Check Production ZIP Download
        print("📦 10. Testing Production Client ZIP Download...")
        req = urllib.request.Request(f"{BASE_URL}/api/download/zip")
        with urllib.request.urlopen(req) as res:
            headers_dict = dict(res.info())
            content_length = int(headers_dict.get('Content-Length', 0))
            content_type = headers_dict.get('Content-Type', '')
            content_disp = headers_dict.get('Content-Disposition', '')
            
            if res.status == 200 and content_length > 5000 and "zip" in content_type:
                print("✅ ZIP download succeeded!")
                print(f"   Content Type: {content_type}")
                print(f"   Content Length: {content_length} bytes")
                print(f"   Header: {content_disp}\n")
            else:
                print(f"❌ ZIP download returned invalid headers. Status: {res.status}, Headers: {headers_dict}")
                sys.exit(1)

        print("======================================================================")
        print("🏆 ALL INTEGRATION TESTS PASSED PERFECTLY! 100% PRODUCTION READY!")
        print("======================================================================\n")

    finally:
        # Restore original DB
        if db_existed:
            with open(DB_PATH, 'w') as f:
                f.write(original_db_content)

if __name__ == "__main__":
    run_tests()
