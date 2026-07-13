# -*- coding: utf-8 -*-
"""
EPG-PRO Licensing Client - Obfuscation, Cryptographic Signing, and Security Verification
"""
import hmac
import hashlib
import json
import os
import sys

try:
    # Python 3 imports
    import urllib.request as urllib2
    import urllib.parse as urllib
    from urllib.error import URLError, HTTPError
except ImportError:
    # Python 2 imports
    import urllib2
    import urllib
    from urllib2 import URLError, HTTPError

SECRET_SALT = "EPG_PRO_SECURE_SALT_9933"  # Must match SIGNATURE_SECRET in server.ts

def scramble(text):
    """
    Scrambles text using XOR + Base64, used to store local cache securely.
    """
    if not text:
        return ""
    try:
        import base64
        key = "EPGPRO_XOR_SECRET_KEY"
        scrambled = bytearray()
        for i in range(len(text)):
            scrambled.append(ord(text[i]) ^ ord(key[i % len(key)]))
        if sys.version_info[0] >= 3:
            return base64.b64encode(scrambled).decode('utf-8')
        else:
            return base64.b64encode(str(scrambled))
    except Exception:
        return text

def unscramble(scrambled_text):
    """
    De-scrambles scrambled text back to original string.
    """
    if not scrambled_text:
        return ""
    try:
        import base64
        key = "EPGPRO_XOR_SECRET_KEY"
        data = base64.b64decode(scrambled_text)
        unscrambled = []
        if sys.version_info[0] >= 3:
            for i in range(len(data)):
                unscrambled.append(chr(data[i] ^ ord(key[i % len(key)])))
        else:
            for i in range(len(data)):
                unscrambled.append(chr(ord(data[i]) ^ ord(key[i % len(key)])))
        return "".join(unscrambled)
    except Exception:
        return scrambled_text

def generate_signature(data_dict, salt=SECRET_SALT):
    """
    Generate SHA256 HMAC signature of the sorted key-value payload.
    Must exactly match signResponse in server.ts
    """
    ordered_keys = sorted(data_dict.keys())
    parts = []
    for k in ordered_keys:
        if k == 'signature':
            continue
        v = data_dict[k]
        if v is None:
            parts.append("%s:" % k)
        elif isinstance(v, dict):
            parts.append("%s:%s" % (k, json.dumps(v, sort_keys=True, separators=(',', ':'))))
        elif isinstance(v, list):
            parts.append("%s:%s" % (k, json.dumps(v, separators=(',', ':'))))
        elif isinstance(v, bool):
            parts.append("%s:%s" % (k, str(v).lower()))
        else:
            parts.append("%s:%s" % (k, str(v)))
    
    message = "|".join(parts)
    
    # Handle Py2/Py3 string compatibility for HMAC
    if sys.version_info[0] >= 3:
        if isinstance(salt, str):
            salt = salt.encode('utf-8')
        if isinstance(message, str):
            message = message.encode('utf-8')
    else:
        salt = str(salt)
        message = str(message)
        
    return hmac.new(salt, message, hashlib.sha256).hexdigest()

def verify_signature(data_dict, salt=SECRET_SALT):
    """
    Verify the response payload signature matches EPG-PRO security server credentials.
    """
    if 'signature' not in data_dict:
        return False
    received_sig = data_dict['signature']
    expected_sig = generate_signature(data_dict, salt)
    
    # Secure constant-time comparison
    if hasattr(hmac, "compare_digest"):
        if sys.version_info[0] >= 3:
            return hmac.compare_digest(str(received_sig), str(expected_sig))
        else:
            return hmac.compare_digest(str(received_sig), str(expected_sig))
    else:
        if len(received_sig) != len(expected_sig):
            return False
        result = 0
        for x, y in zip(received_sig, expected_sig):
            result |= ord(x) ^ ord(y)
        return result == 0

def make_request(url, payload_dict):
    """
    Performs secure POST request to the licensing server using urllib/urllib2.
    """
    try:
        data = json.dumps(payload_dict)
        if sys.version_info[0] >= 3:
            data = data.encode('utf-8')
            
        req = urllib2.Request(url, data=data)
        req.add_header('Content-Type', 'application/json')
        req.add_header('User-Agent', 'Enigma2 EPG-PRO Client Node')
        
        response = urllib2.urlopen(req, timeout=10)
        res_data = response.read()
        
        if sys.version_info[0] >= 3:
            res_data = res_data.decode('utf-8')
            
        return json.loads(res_data), response.getcode()
    except HTTPError as e:
        try:
            err_data = e.read()
            if sys.version_info[0] >= 3:
                err_data = err_data.decode('utf-8')
            return json.loads(err_data), e.code
        except Exception:
            return {"success": False, "message": "Server returned HTTP Error %d" % e.code}, e.code
    except URLError as e:
        return {"success": False, "message": "Network unreachable: %s" % str(e.reason)}, 0
    except Exception as e:
        return {"success": False, "message": "Internal request failure: %s" % str(e)}, 0
