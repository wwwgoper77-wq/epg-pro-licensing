# -*- coding: utf-8 -*-
# Python Obfuscator & Production ZIP Packager
# Builds the protected production version of Arabic EPG Translator for Enigma2.

import os
import zlib
import base64
import zipfile
import shutil

SOURCE_DIR = "arabic_epg_client"
BUILD_DIR = "tmp/arabic_epg_build"
ZIP_NAME = "arabic_epg_protected.zip"

def load_env():
    """Parses a local .env file into a dictionary of configurations."""
    env = {}
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    # Strip spaces and optional surrounding quotes
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    env[key] = val
    return env

def obfuscate_code(content, name):
    print(f"-> Obfuscating {name}...")
    # Clean up double line breaks and simple comments to optimize size before compression
    lines = content.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Keep encoding line or standard declarations, but strip large comments if not license block
        if stripped.startswith('#') and not any(k in stripped for k in ['-*-', 'PRO', 'Licensed', 'EPG']):
            continue
        cleaned_lines.append(line)
    
    clean_code = '\n'.join(cleaned_lines)
    
    # Pack with zlib compression + base64 encoding
    compressed = zlib.compress(clean_code.encode('utf-8'), level=9)
    b64_bytes = base64.b64encode(compressed)
    b64_str = b64_bytes.decode('utf-8')
    
    # Custom protected template with anti-tamper message and decryption executor
    obfuscated = f"""# -*- coding: utf-8 -*-
# ==============================================================================
# Arabic EPG Translator Commercial Edition - Protected Core Module
# Compiled under EPG-PRO Anti-Tamper Security System v1.0
# Warning: Unauthorised decompilation, extraction or tampering triggers licensing ban.
# (c) 2026 EPG-PRO Ltd. All rights reserved.
# ==============================================================================

import zlib
import base64

_epg_data = b'''{b64_str}'''

try:
    _dec = zlib.decompress(base64.b64decode(_epg_data)).decode('utf-8')
    exec(_dec, globals())
except Exception as _e:
    print("[EPG-PRO Anti-Tamper Error] Core module integrity check failed: " + str(_e))
    import sys
    sys.exit(1)
"""
    return obfuscated

def build_production_package():
    print("=== STARTING COMMERCIAL PRODUCTION BUILD ===")
    
    # Load env configurations
    env_vars = load_env()
    
    # Fetch target production configurations from env or shell environment
    app_url = os.environ.get("APP_URL") or env_vars.get("APP_URL")
    sig_secret = os.environ.get("SIGNATURE_SECRET") or env_vars.get("SIGNATURE_SECRET")
    
    if not app_url:
        print("[!] ERROR: APP_URL is not set in environment or .env file.")
        print("    Please define APP_URL (your production server URL, e.g. https://my-licensing-server.com) before building.")
        return False
        
    if not sig_secret:
        print("[!] ERROR: SIGNATURE_SECRET is not set in environment or .env file.")
        print("    Please define SIGNATURE_SECRET (cryptographic salt, e.g. EPG_ARABIC_SECRET_2026) before building.")
        return False
        
    print(f"📡 Found Build Target: {app_url}")
    print(f"🔑 Found Cryptographic Salt: {sig_secret[:6]}...")
    
    # Clean previous build directories
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)
    
    # List of files in client source
    files = ["__init__.py", "plugin.py", "translator.py", "install.sh", "uninstall.sh"]
    
    for filename in files:
        src_path = os.path.join(SOURCE_DIR, filename)
        dest_path = os.path.join(BUILD_DIR, filename)
        
        if not os.path.exists(src_path):
            print(f"[!] Error: Source file {src_path} is missing!")
            return False
            
        with open(src_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # We only obfuscate active python logic files to avoid breaking init or shell execution
        if filename in ["plugin.py", "translator.py"]:
            if filename == "plugin.py":
                # Perform dynamic regex injection for LICENSE_SERVER and SECRET_SALT
                import re
                print("-> Injecting build targets into plugin.py...")
                content = re.sub(r'LICENSE_SERVER\s*=\s*["\'].*?["\']', f'LICENSE_SERVER = "{app_url}"', content)
                content = re.sub(r'SECRET_SALT\s*=\s*["\'].*?["\']', f'SECRET_SALT = "{sig_secret}"', content)
                
            obfuscated_content = obfuscate_code(content, filename)
            with open(dest_path, "w", encoding="utf-8") as f_out:
                f_out.write(obfuscated_content)
        else:
            print(f"-> Copying clean file {filename}...")
            # Keep __init__.py and shell scripts clean for loading and shell executing compatibility
            with open(dest_path, "w", encoding="utf-8") as f_out:
                f_out.write(content)
                
    # Create the final ZIP archive with nested folder structure
    print(f"-> Archiving production files to {ZIP_NAME}...")
    if os.path.exists(ZIP_NAME):
        os.remove(ZIP_NAME)
        
    with zipfile.ZipFile(ZIP_NAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, filenames in os.walk(BUILD_DIR):
            for filename in filenames:
                full_path = os.path.join(root, filename)
                # Nest files inside "ArabicEPGTranslator" folder inside the zip for standard installation extraction
                arc_path = os.path.join("ArabicEPGTranslator", filename)
                zipf.write(full_path, arc_path)
                
    print("=== PRODUCTION BUILD GENERATED SUCCESSFULLY ===")
    print(f"Zip created at: {ZIP_NAME} ({os.path.getsize(ZIP_NAME)} bytes)")
    return True

if __name__ == "__main__":
    build_production_package()
