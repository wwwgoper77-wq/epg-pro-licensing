# -*- coding: utf-8 -*-
# Arabic EPG Translator - Enigma2 Client Settings Screen
# Compatible with Python 3 Enigma2 (OpenATV, OpenPLi, Egami, DreamOS, etc.)
# (c) 2026 EPG-PRO Ltd. All rights reserved.

import os
import sys
import json
import hashlib
import uuid
import time
from urllib.request import urlopen, Request
from urllib.parse import urlencode

# Enigma2 Standard GUI Imports (mocked safely if running outside Enigma2 environment)
try:
    from Plugins.Plugin import PluginDescriptor
    from Screens.Screen import Screen
    from Screens.MessageBox import MessageBox
    from Components.Label import Label
    from Components.ActionMap import ActionMap
    from Components.ConfigList import ConfigListScreen
    from Components.config import config, ConfigText, ConfigSelection, getConfigListEntry, ConfigSubDict, configfile
    from Components.Sources.StaticText import StaticText
    ENIGMA_AVAILABLE = True
except ImportError:
    ENIGMA_AVAILABLE = False
    # Mocking basic config for script standalone testing/obfuscation pipeline
    class MockConfig:
        def __init__(self):
            self.license_key = "EPG-PRO-LIFETIME"
    class MockConfigfile:
        def save(self): pass
    config = MockConfig()
    configfile = MockConfigfile()

# Constants
LICENSE_SERVER = "https://epg-pro-licensing-production.up.railway.app"
SECRET_SALT = "EPG_ARABIC_SECRET_2026_XYZ_9876543213333454"
CACHE_PATH = "/etc/enigma2/arabic_epg.lic"

# Hardware ID Generator (Receiver Binding)
def get_hardware_id():
    """Generates a stable unique hardware fingerprint bound to the Enigma2 box."""
    machine_id = ""
    for path in ['/etc/machine-id', '/var/lib/dbus/machine-id']:
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    machine_id = f.read().strip()
                    break
            except:
                pass
    
    mac = ""
    try:
        # Standard way to fetch a MAC address safely on Enigma2
        for interface in ['eth0', 'wlan0', 'eth1']:
            if os.path.exists(f'/sys/class/net/{interface}/address'):
                with open(f'/sys/class/net/{interface}/address', 'r') as f:
                    mac = f.read().strip().replace(':', '')
                    break
        if not mac:
            mac = str(uuid.getnode())
    except:
        mac = "001122334455"
        
    raw_hwid = f"ArabicEPG-{machine_id}-{mac}"
    return hashlib.sha256(raw_hwid.encode('utf-8')).hexdigest()[:16].upper()

# Get Enigma2 Image details
def get_enigma_image():
    if os.path.exists('/etc/issue'):
        try:
            with open('/etc/issue', 'r') as f:
                content = f.read().lower()
                for img in ['openatv', 'openpli', 'egami', 'blackhole', 'vix', 'dreamos']:
                    if img in content:
                        return img.upper()
        except:
            pass
    return "OPENATV"

# Get Receiver Model
def get_receiver_model():
    if os.path.exists('/proc/stb/info/boxtype'):
        try:
            with open('/proc/stb/info/boxtype', 'r') as f:
                return f.read().strip().upper()
        except:
            pass
    return "VU+ UNO 4K SE"

# Verify Digital Signature of License (Anti-Tamper)
def verify_license_signature(key, hwid, expires_at, signature):
    raw_signature = f"{key}:{hwid}:{expires_at}:{SECRET_SALT}"
    expected = hashlib.sha256(raw_signature.encode('utf-8')).hexdigest()
    return expected == signature

# Read local license cache
def read_license_cache():
    if not os.path.exists(CACHE_PATH):
        return None
    try:
        with open(CACHE_PATH, 'r') as f:
            data = json.loads(f.read())
            # Basic validation
            if verify_license_signature(data.get("key"), data.get("hwid"), data.get("expires_at"), data.get("signature")):
                return data
    except:
        pass
    return None

# Save local license cache
def save_license_cache(key, hwid, expires_at, signature):
    try:
        data = {
            "key": key,
            "hwid": hwid,
            "expires_at": expires_at,
            "signature": signature,
            "last_verified": int(time.time())
        }
        with open(CACHE_PATH, 'w') as f:
            f.write(json.dumps(data, indent=2))
        return True
    except:
        return False

# Global licensing verifier (used by translator.py)
def check_license_status():
    """
    Checks the license status (online verification with offline grace period fallback).
    Returns tuple: (status_code, status_message)
    status_code: 'Activated', 'OfflineGrace', 'Expired', 'Revoked', 'NotActivated'
    """
    hwid = get_hardware_id()
    cache = read_license_cache()
    
    if not cache:
        return "NotActivated", "No license key registered. Please configure and activate the plugin."

    key = cache.get("key")
    expires_at = cache.get("expires_at")
    signature = cache.get("signature")
    last_verified = cache.get("last_verified", 0)

    # Perform online verification attempt
    try:
        url = f"{LICENSE_SERVER}/api/license/verify?key={key}&hwid={hwid}"
        req = Request(url, headers={'User-Agent': 'Enigma2/ArabicEPGTranslator'})
        with urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get("success"):
                # Online check succeeded, update local cache
                new_expiry = res_data.get("expires_at")
                new_sig = res_data.get("signature")
                save_license_cache(key, hwid, new_expiry, new_sig)
                
                # Check actual expiry datetime
                if new_expiry != "lifetime":
                    # Check if expired
                    from datetime import datetime
                    exp_dt = datetime.strptime(new_expiry.split('.')[0].replace('Z', ''), '%Y-%m-%dT%H:%M:%S')
                    if exp_dt < datetime.utcnow():
                        return "Expired", "License has expired. Please renew your subscription."
                
                return "Activated", f"License is Activated (Expires: {new_expiry})"
    except Exception as e:
        # Offline validation fallback (Grace Period)
        current_time = int(time.time())
        one_day = 86400
        grace_days = 7
        
        # Check signature again
        if verify_license_signature(key, hwid, expires_at, signature):
            # Check expiration dates in offline mode
            if expires_at != "lifetime":
                try:
                    # e.g., 2026-08-13T00:56:04.000Z or similar
                    from datetime import datetime
                    exp_dt = datetime.strptime(expires_at.split('.')[0].replace('Z', ''), '%Y-%m-%dT%H:%M:%S')
                    if exp_dt < datetime.utcnow():
                        return "Expired", "License has expired. Internet connection is required to check renewal."
                except:
                    pass

            elapsed_seconds = current_time - last_verified
            if elapsed_seconds <= (grace_days * one_day):
                days_left = int(grace_days - (elapsed_seconds / one_day))
                return "OfflineGrace", f"Offline Grace Period active ({days_left} days remaining)."
            else:
                return "Expired", "Offline grace limit exceeded (7 days). Please connect to the internet to verify."
        else:
            return "Revoked", "Tampering detected in local license cache."

    return "NotActivated", "License is not active."


if ENIGMA_AVAILABLE:
    # Setup global Enigma2 configs
    config.plugins.arabic_epg = ConfigSubDict()
    config.plugins.arabic_epg.license_key = ConfigText(default="", fixed_size=False)
    config.plugins.arabic_epg.engine = ConfigSelection(default="gemini", choices=[
        ("gemini", "Gemini Pro Translator (Default)"),
        ("google", "Google Translate (Free)"),
        ("deepl", "DeepL (Premium)")
    ])

    class ArabicEPGTranslatorConfigScreen(ConfigListScreen, Screen):
        skin = """
            <screen name="ArabicEPGTranslatorConfigScreen" position="center,center" size="650,450" title="Arabic EPG Translator Settings">
                <!-- Header -->
                <widget name="title_label" position="15,10" size="620,35" font="Regular;22" halign="center" valign="middle" foregroundColor="#00FFCC" />
                
                <!-- Separator -->
                <widget name="sep" position="15,45" size="620,2" backgroundColor="#555555" />
                
                <!-- Main Configurations -->
                <widget name="config" position="15,65" size="620,180" scrollbarMode="showOnDemand" />
                
                <!-- Info Section -->
                <widget name="hwid_label" position="15,255" size="620,25" font="Regular;16" halign="left" foregroundColor="#AAAAAA" />
                <widget name="status_label" position="15,285" size="620,40" font="Bold;18" halign="left" valign="middle" foregroundColor="#FFAA00" />
                
                <!-- Separator -->
                <widget name="sep2" position="15,335" size="620,2" backgroundColor="#555555" />

                <!-- Buttons Footer -->
                <widget name="key_red" position="15,355" size="140,40" font="Regular;16" halign="center" valign="middle" backgroundColor="#9F1D2F" foregroundColor="#FFFFFF" />
                <widget name="key_green" position="170,355" size="140,40" font="Regular;16" halign="center" valign="middle" backgroundColor="#1A7F37" foregroundColor="#FFFFFF" />
                <widget name="key_yellow" position="325,355" size="150,40" font="Regular;16" halign="center" valign="middle" backgroundColor="#D29922" foregroundColor="#FFFFFF" />
                <widget name="key_blue" position="490,355" size="145,40" font="Regular;16" halign="center" valign="middle" backgroundColor="#0969DA" foregroundColor="#FFFFFF" />
                
                <widget name="status_bar" position="15,410" size="620,25" font="Regular;14" halign="center" valign="middle" foregroundColor="#888888" />
            </screen>
        """

        def __init__(self, session):
            Screen.__init__(self, session)
            self.session = session
            
            # Setup widgets
            self["title_label"] = Label("Arabic EPG Translator Pro - Commercial Licensing Panel")
            self["sep"] = Label("")
            self["sep2"] = Label("")
            self["hwid_label"] = Label(f"Receiver Hardware ID (HWID): {get_hardware_id()}")
            self["status_label"] = Label("Loading license status...")
            self["status_bar"] = Label("EPG-PRO Verification Engine v2.1.0")
            
            # Buttons
            self["key_red"] = Label("Exit / Cancel")
            self["key_green"] = Label("Save Settings")
            self["key_yellow"] = Label("Activate Online")
            self["key_blue"] = Label("Check Status")

            # Setup config list
            self.list = []
            ConfigListScreen.__init__(self, self.list, session=self.session)
            self.setup_config_list()

            # Actions map
            self["setup_actions"] = ActionMap(["SetupActions", "ColorActions"], {
                "cancel": self.keyCancel,
                "ok": self.keySave,
                "red": self.keyCancel,
                "green": self.keySave,
                "yellow": self.keyActivate,
                "blue": self.update_license_display
            }, -2)

            self.onLayoutComplete.append(self.update_license_display)

        def setup_config_list(self):
            self.list = [
                getConfigListEntry("License Activation Key:", config.plugins.arabic_epg.license_key),
                getConfigListEntry("Translation Engine:", config.plugins.arabic_epg.engine)
            ]
            self["config"].list = self.list
            self["config"].l.setList(self.list)

        def update_license_display(self):
            # Check standard status
            status_code, status_msg = check_license_status()
            cache = read_license_cache()
            
            display_text = f"Status: {status_code.upper()}\nDetails: {status_msg}"
            
            if status_code == "Activated":
                self["status_label"].setText(display_text)
                # Cyan/Teal color
                self["status_label"].foregroundColor = 0x00FFCC
            elif status_code == "OfflineGrace":
                self["status_label"].setText(display_text)
                self["status_label"].foregroundColor = 0xD29922
            else:
                self["status_label"].setText(display_text)
                self["status_label"].foregroundColor = 0xF85149

        def keyActivate(self):
            license_key = config.plugins.arabic_epg.license_key.value.strip()
            if not license_key:
                self.session.open(MessageBox, "Please enter a license key first inside the settings field.", MessageBox.TYPE_ERROR)
                return

            self["status_label"].setText("Sending activation request to server...")
            
            hwid = get_hardware_id()
            image = get_enigma_image()
            model = get_receiver_model()

            # Build request
            try:
                url = f"{LICENSE_SERVER}/api/license/activate"
                post_data = urlencode({
                    'key': license_key,
                    'hwid': hwid,
                    'image': image,
                    'model': model
                }).encode('utf-8')

                req = Request(url, data=post_data, headers={'User-Agent': 'Enigma2/ArabicEPGTranslator'})
                
                with urlopen(req, timeout=8) as response:
                    res_body = json.loads(response.read().decode('utf-8'))
                    
                    if res_body.get("success"):
                        # Activation successful! Parse parameters and write cache file
                        key = res_body.get("key")
                        expiry = res_body.get("expires_at")
                        signature = res_body.get("signature")
                        
                        save_license_cache(key, hwid, expiry, signature)
                        self.update_license_display()
                        
                        self.session.open(MessageBox, "License Activated Successfully!\nAll commercial features are now unlocked.", MessageBox.TYPE_INFO)
                    else:
                        error_msg = res_body.get("error", "Activation failed.")
                        self["status_label"].setText(f"Status: ACTIVATION FAILED\n{error_msg}")
                        self.session.open(MessageBox, f"Activation Failed:\n{error_msg}", MessageBox.TYPE_ERROR)
            
            except Exception as e:
                # Catch detailed network errors or 400/403/404 responses which raise exception in urllib
                err_str = str(e)
                try:
                    # Attempt to read response error body if urllib raised HTTPError
                    if hasattr(e, 'read'):
                        err_body = json.loads(e.read().decode('utf-8'))
                        err_str = err_body.get("error", err_str)
                except:
                    pass
                
                self["status_label"].setText(f"Status: CONNECTION ERROR\nUnable to reach licensing server.")
                self.session.open(MessageBox, f"Licensing Server Connection Error:\n{err_str}\n\nPlease check your internet connection.", MessageBox.TYPE_ERROR)
                self.update_license_display()

        def keySave(self):
            # Save configs
            config.plugins.arabic_epg.license_key.save()
            config.plugins.arabic_epg.engine.save()
            configfile.save()
            self.close()

        def keyCancel(self):
            self.close()

    def main(session, **kwargs):
        session.open(ArabicEPGTranslatorConfigScreen)

    def Plugins(**kwargs):
        return [
            PluginDescriptor(
                name="Arabic EPG Translator Settings",
                description="Configure License Key and Translation Engines",
                where=PluginDescriptor.WHERE_PLUGINMENU,
                icon="icon.png",
                fnc=main
            )
        ]
