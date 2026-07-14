# -*- coding: utf-8 -*-
from Plugins.Plugin import PluginDescriptor
from Screens.Screen import Screen
from Components.ConfigList import ConfigListScreen
from Components.config import config, ConfigSubsection, ConfigYesNo, ConfigSelection, ConfigText, getConfigListEntry
from Components.ActionMap import ActionMap
from Components.Label import Label
from Screens.MessageBox import MessageBox
import enigma
import os
import json
import hmac
import hashlib
from datetime import datetime

# Import translator functions and licensing hooks
from .translator import get_translation, load_all_caches, save_all_caches, clear_all_caches, get_stats, set_license_valid, is_license_valid

# Define the Configuration Subsection
config.plugins.arabic_epg = ConfigSubsection()
config.plugins.arabic_epg.enabled = ConfigYesNo(default=True)
config.plugins.arabic_epg.translate_title = ConfigYesNo(default=True)
config.plugins.arabic_epg.translate_short = ConfigYesNo(default=True)
config.plugins.arabic_epg.translate_extended = ConfigYesNo(default=True)
config.plugins.arabic_epg.translate_channels = ConfigYesNo(default=True)

# Translation providers and credentials
config.plugins.arabic_epg.provider = ConfigSelection(default="Google", choices=[
    ("Google", "Google Translate (Free)"),
    ("DeepL", "DeepL API (Free/Pro)"),
    ("Gemini", "Gemini API (Google Cloud)")
])
config.plugins.arabic_epg.deepl_key = ConfigText(default="", visible_width=50, fixed_size=False)
config.plugins.arabic_epg.gemini_key = ConfigText(default="", visible_width=50, fixed_size=False)

# Licensing Server Config
config.plugins.arabic_epg.license_key = ConfigText(default="", visible_width=50, fixed_size=False)
config.plugins.arabic_epg.license_server = ConfigText(default="https://ais-dev-62abgaelcwkbp6qhhxg5kp-559956860993.europe-west2.run.app", visible_width=50, fixed_size=False)

# Signature and Licensing constants
LICENSE_FILE = "/etc/enigma2/arabic_epg.lic"
SIGNATURE_SECRET = "arabic_epg_translator_pro_secret_key"

# -------------------------------------------------------------
# Core Translation Engine Wrapper (Requested)
# -------------------------------------------------------------
def translate(text, cache_type="title", callback=None):
    """
    Main translate hook wrapper. Translates text through the translation engine.
    """
    return get_translation(text, cache_type=cache_type, callback=callback)

def translate_epg(session, event, callback=None):
    """
    Translates an active EPG event structure.
    """
    if not event:
        return ""
    title = event.getEventName() or ""
    return get_translation(title, cache_type="title", callback=callback)

# -------------------------------------------------------------
# Hardware ID (HWID) Generator
# -------------------------------------------------------------
def get_hwid():
    """
    Generates a unique 16-character hardware identifier based on box characteristics.
    Python 2 and Python 3 compatible.
    """
    mac = ""
    try:
        if os.path.exists("/sys/class/net/eth0/address"):
            with open("/sys/class/net/eth0/address", "r") as f:
                mac = f.read().strip()
    except Exception:
        pass
    if not mac:
        try:
            import uuid
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0,8*6,8)][::-1])
        except Exception:
            mac = "00:11:22:33:44:55"
            
    serial = ""
    try:
        if os.path.exists("/proc/cpuinfo"):
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "Serial" in line or "serial" in line:
                        serial = line.split(":")[-1].strip()
                        break
    except Exception:
        pass
        
    import hashlib
    hwid_src = "%s-%s" % (mac, serial)
    return hashlib.sha256(hwid_src.encode("utf-8")).hexdigest()[:16].upper()

# -------------------------------------------------------------
# HMAC-SHA256 Signature Verification
# -------------------------------------------------------------
def verify_signature(license_key, hwid, expires_at, signature):
    """
    Validates HMAC-SHA256 license signatures for secure offline capability.
    """
    try:
        message = "%s:%s:%s" % (license_key, hwid, expires_at)
        if isinstance(SIGNATURE_SECRET, str):
            secret_bytes = SIGNATURE_SECRET.encode('utf-8')
        else:
            secret_bytes = SIGNATURE_SECRET
            
        if isinstance(message, str):
            message_bytes = message.encode('utf-8')
        else:
            message_bytes = message
            
        expected = hmac.new(secret_bytes, message_bytes, hashlib.sha256).hexdigest()
        
        # Timing attack safe comparison (Python 2 and 3 compatible)
        if hasattr(hmac, "compare_digest"):
            return hmac.compare_digest(expected, signature)
        if len(expected) != len(signature):
            return False
        result = 0
        for x, y in zip(expected, signature):
            result |= ord(x) ^ ord(y)
        return result == 0
    except Exception as e:
        print("[ArabicEPG] Signature verification failed: %s" % str(e))
        return False

# -------------------------------------------------------------
# Local License Cache (Read/Write)
# -------------------------------------------------------------
def save_license_cache(data):
    """
    Saves verified license payload to offline local cache file.
    """
    try:
        parent = os.path.dirname(LICENSE_FILE)
        if not os.path.exists(parent):
            os.makedirs(parent)
        with open(LICENSE_FILE, "w") as f:
            json.dump(data, f)
        print("[ArabicEPG] Saved license to offline cache file.")
    except Exception as e:
        print("[ArabicEPG] Error saving license cache: %s" % str(e))

def show_cached_license_status():
    """
    Performs fast local offline validation of the license signature.
    Returns: (is_valid, status_text, license_data)
    """
    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, "r") as f:
                data = json.load(f)
                
            key = data.get("key", "")
            hwid = data.get("hwid", "")
            expires_at = data.get("expires_at", "")
            signature = data.get("signature", "")
            tier = data.get("tier", "Premium")
            
            # Check HWID lock
            current_hwid = get_hwid()
            if hwid != current_hwid:
                print("[ArabicEPG] Cached license HWID mismatch.")
                return False, "HWID Mismatch", data
                
            # Verify signature against local secret
            if verify_signature(key, hwid, expires_at, signature):
                try:
                    exp_date = datetime.strptime(expires_at, "%Y-%m-%d")
                    if exp_date >= datetime.now():
                        # Enable translation engine immediately
                        set_license_valid(True)
                        return True, "Activated", data
                    else:
                        set_license_valid(False)
                        return False, "Expired", data
                except Exception:
                    pass
            set_license_valid(False)
            return False, "Invalid Signature", data
        except Exception as e:
            print("[ArabicEPG] Error reading cached license: %s" % str(e))
    set_license_valid(False)
    return False, "Not Activated", None

# -------------------------------------------------------------
# Online License Server Verification
# -------------------------------------------------------------
def check_license_status(callback=None):
    """
    Contacts the Node/Express commercial status endpoint.
    If valid, updates cache and enables translation.
    If revoked, disables translation.
    If server offline, falls back to offline grace mode seamlessly.
    """
    try:
        key = config.plugins.arabic_epg.license_key.value.strip()
        hwid = get_hwid()
        server_url = config.plugins.arabic_epg.license_server.value.strip()
        
        if not key:
            set_license_valid(False)
            if callback:
                callback(False, "Not Activated")
            return
            
        url = "%s/api/license/status" % server_url
        params = {
            "key": key,
            "hwid": hwid
        }
        
        import urllib.request
        import urllib.parse
        data = json.dumps(params).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=4) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if res_data.get("success"):
                # Save status to offline license cache
                license_data = {
                    "key": key,
                    "hwid": hwid,
                    "expires_at": res_data.get("expires_at"),
                    "tier": res_data.get("tier"),
                    "signature": res_data.get("signature")
                }
                save_license_cache(license_data)
                set_license_valid(True)
                
                if callback:
                    callback(True, "Activated")
            else:
                # License is explicitly revoked or invalid from the remote server
                set_license_valid(False)
                if os.path.exists(LICENSE_FILE):
                    try:
                        os.remove(LICENSE_FILE)
                    except Exception:
                        pass
                if callback:
                    callback(False, res_data.get("error", "Revoked"))
    except Exception as e:
        print("[ArabicEPG] Online check failed: %s. Entering Offline Grace Mode..." % str(e))
        # Offline Grace Mode: Fallback to cached license state
        is_valid, status, _ = show_cached_license_status()
        if is_valid:
            set_license_valid(True)
            if callback:
                callback(True, "Activated (Grace Mode)")
        else:
            set_license_valid(False)
            if callback:
                callback(False, "Offline / Unverified")

def start_license_check():
    """
    Triggers online status verification in a non-blocking background daemon thread.
    """
    import threading
    t = threading.Thread(target=check_license_status)
    t.daemon = True
    t.start()

# -------------------------------------------------------------
# Original Enigma2 C++ Method Hooks
# -------------------------------------------------------------
original_getEventName = None
if hasattr(enigma, "eServiceEvent") and hasattr(enigma.eServiceEvent, "getEventName"):
    original_getEventName = enigma.eServiceEvent.getEventName

original_getShortDescription = None
if hasattr(enigma, "eServiceEvent") and hasattr(enigma.eServiceEvent, "getShortDescription"):
    original_getShortDescription = enigma.eServiceEvent.getShortDescription

original_getExtendedDescription = None
if hasattr(enigma, "eServiceEvent") and hasattr(enigma.eServiceEvent, "getExtendedDescription"):
    original_getExtendedDescription = enigma.eServiceEvent.getExtendedDescription

original_getServiceName_Ref = None
if hasattr(enigma, "eServiceReference") and hasattr(enigma.eServiceReference, "getName"):
    original_getServiceName_Ref = enigma.eServiceReference.getName

original_getServiceName_Static = None
if hasattr(enigma, "iStaticServiceInformation") and hasattr(enigma.iStaticServiceInformation, "getName"):
    original_getServiceName_Static = enigma.iStaticServiceInformation.getName

original_getServiceName_Info = None
if hasattr(enigma, "iServiceInformation") and hasattr(enigma.iServiceInformation, "getName"):
    original_getServiceName_Info = enigma.iServiceInformation.getName

# Session reference to trigger screen redraws
global_session = None
_refresh_timer = None

def refresh_screens():
    """
    Forces immediate redraw of active widgets, EPG panels, and ChannelSelection lists.
    """
    if global_session:
        try:
            current_dialog = global_session.current_dialog
            if current_dialog:
                current_dialog.invalidate()
                if hasattr(current_dialog, "items"):
                    for key, val in current_dialog.items():
                        if hasattr(val, "invalidate"):
                            try:
                                val.invalidate()
                            except Exception:
                                pass
                        if hasattr(val, "instance") and val.instance and hasattr(val.instance, "invalidate"):
                            try:
                                val.instance.invalidate()
                            except Exception:
                                pass
                if hasattr(current_dialog, "servicelist") and current_dialog.servicelist:
                    try:
                        if hasattr(current_dialog.servicelist, "updateList"):
                            current_dialog.servicelist.updateList()
                    except Exception:
                        pass
                if "list" in current_dialog:
                    try:
                        list_widget = current_dialog["list"]
                        if hasattr(list_widget, "updateList"):
                            list_widget.updateList()
                    except Exception:
                        pass
        except Exception as e:
            print("[ArabicEPG] Error during refresh_screens: %s" % str(e))

def trigger_screen_refresh():
    """
    Debounces list redrawing on the main thread via eTimer for perfect stability.
    """
    global _refresh_timer
    
    def do_refresh():
        global _refresh_timer
        _refresh_timer = None
        refresh_screens()
        
    if _refresh_timer is not None:
        return
        
    try:
        from enigma import eTimer
        _refresh_timer = eTimer()
        if hasattr(_refresh_timer, "timeout") and hasattr(_refresh_timer.timeout, "connect"):
            _refresh_timer.timeout.connect(do_refresh)
        elif hasattr(_refresh_timer, "callback") and hasattr(_refresh_timer.callback, "append"):
            _refresh_timer.callback.append(do_refresh)
        else:
            do_refresh()
            return
            
        _refresh_timer.start(80, True)
    except Exception as e:
        print("[ArabicEPG] Failed to schedule refresh timer: %s" % str(e))
        refresh_screens()

def translation_callback(original, translated):
    """
    Triggers UI refresh when an async background translation finishes.
    """
    trigger_screen_refresh()

# Hooked functions
def new_getEventName(self, *args, **kwargs):
    orig = original_getEventName(self, *args, **kwargs) or "" if original_getEventName else ""
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_title.value:
        return orig
    return get_translation(orig, cache_type="title", callback=translation_callback)

def new_getShortDescription(self, *args, **kwargs):
    orig = original_getShortDescription(self, *args, **kwargs) or "" if original_getShortDescription else ""
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_short.value:
        return orig
    return get_translation(orig, cache_type="short_description", callback=translation_callback)

def new_getExtendedDescription(self, *args, **kwargs):
    orig = original_getExtendedDescription(self, *args, **kwargs) or "" if original_getExtendedDescription else ""
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_extended.value:
        return orig
    return get_translation(orig, cache_type="description", callback=translation_callback)

def new_getServiceName_Ref(self, *args, **kwargs):
    orig = ""
    try:
        orig = original_getServiceName_Ref(self, *args, **kwargs) or ""
    except Exception:
        pass
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
        return orig
    return get_translation(orig, cache_type="channel", callback=translation_callback)

def new_getServiceName_Static(self, *args, **kwargs):
    orig = ""
    try:
        orig = original_getServiceName_Static(self, *args, **kwargs) or ""
    except Exception:
        pass
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
        return orig
    return get_translation(orig, cache_type="channel", callback=translation_callback)

def new_getServiceName_Info(self, *args, **kwargs):
    orig = ""
    try:
        orig = original_getServiceName_Info(self, *args, **kwargs) or ""
    except Exception:
        pass
    if not orig:
        return orig
    if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
        return orig
    return get_translation(orig, cache_type="channel", callback=translation_callback)

def hook_converter_or_renderer(class_path):
    try:
        parts = class_path.split('.')
        module_path = ".".join(parts[:-1])
        class_name = parts[-1]
        
        module = __import__(module_path, fromlist=[class_name])
        cls = getattr(module, class_name)
        
        hooked = False
        
        if hasattr(cls, "changed"):
            original_changed = cls.changed
            def new_changed(self, *args, **kwargs):
                try:
                    original_changed(self, *args, **kwargs)
                except Exception:
                    pass
                try:
                    orig = self.text or ""
                    if orig and config.plugins.arabic_epg.enabled.value and config.plugins.arabic_epg.translate_channels.value:
                        translated = get_translation(orig, cache_type="channel", callback=translation_callback)
                        if translated and translated != orig:
                            self.text = translated
                except Exception:
                    pass
            cls.changed = new_changed
            hooked = True
            
        if hasattr(cls, "text") and not hasattr(cls, "_arabic_epg_hooked"):
            original_text = cls.text
            @property
            def new_text(self):
                orig = ""
                try:
                    if hasattr(original_text, "fget"):
                        orig = original_text.fget(self) or ""
                    else:
                        orig = original_text or ""
                except Exception:
                    pass
                if not orig:
                    return orig
                if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
                    return orig
                return get_translation(orig, cache_type="channel", callback=translation_callback)
            cls.text = new_text
            cls._arabic_epg_hooked = True
            hooked = True
            
        if hasattr(cls, "getText"):
            original_getText = cls.getText
            def new_getText(self, *args, **kwargs):
                orig = ""
                try:
                    orig = original_getText(self, *args, **kwargs) or ""
                except Exception:
                    pass
                if not orig:
                    return orig
                if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
                    return orig
                return get_translation(orig, cache_type="channel", callback=translation_callback)
            cls.getText = new_getText
            hooked = True
            
        if hooked:
            print("[ArabicEPG] Dynamic hooks loaded on %s" % class_path)
    except Exception as e:
        print("[ArabicEPG] Dynamic hook skipped for %s: %s" % (class_path, str(e)))

# Register and apply hooks automatically on startup
def apply_hooks():
    print("[ArabicEPG] Dynamic engine hooks starting...")
    if original_getEventName:
        try:
            enigma.eServiceEvent.getEventName = new_getEventName
        except Exception as e:
            print("[ArabicEPG] Failed to hook eServiceEvent.getEventName: %s" % str(e))
            
    if original_getShortDescription:
        try:
            enigma.eServiceEvent.getShortDescription = new_getShortDescription
        except Exception as e:
            print("[ArabicEPG] Failed to hook eServiceEvent.getShortDescription: %s" % str(e))
            
    if original_getExtendedDescription:
        try:
            enigma.eServiceEvent.getExtendedDescription = new_getExtendedDescription
        except Exception as e:
            print("[ArabicEPG] Failed to hook eServiceEvent.getExtendedDescription: %s" % str(e))
            
    if original_getServiceName_Ref:
        try:
            enigma.eServiceReference.getName = new_getServiceName_Ref
        except Exception as e:
            print("[ArabicEPG] Failed to hook eServiceReference.getName: %s" % str(e))
            
    if original_getServiceName_Static:
        try:
            enigma.iStaticServiceInformation.getName = new_getServiceName_Static
        except Exception as e:
            print("[ArabicEPG] Failed to hook iStaticServiceInformation.getName: %s" % str(e))
            
    if original_getServiceName_Info:
        try:
            enigma.iServiceInformation.getName = new_getServiceName_Info
        except Exception as e:
            print("[ArabicEPG] Failed to hook iServiceInformation.getName: %s" % str(e))

    converters_renderers = [
        "Components.Converter.ServiceName.ServiceName",
        "Components.Converter.ServiceName2.ServiceName2",
        "Components.Converter.ServiceName3.ServiceName3",
        "Components.Renderer.ServiceName.ServiceName",
        "Components.Renderer.ServiceName2.ServiceName2",
        "Components.Renderer.ServiceName3.ServiceName3"
    ]
    for target in converters_renderers:
        hook_converter_or_renderer(target)

    try:
        from Components.Sources.CurrentService import CurrentService
        original_CurrentService_getServiceName = CurrentService.getServiceName
        
        def new_CurrentService_getServiceName(self, *args, **kwargs):
            orig = ""
            try:
                orig = original_CurrentService_getServiceName(self, *args, **kwargs) or ""
            except Exception:
                pass
            if not orig:
                return orig
            if not config.plugins.arabic_epg.enabled.value or not config.plugins.arabic_epg.translate_channels.value:
                return orig
            return get_translation(orig, cache_type="channel", callback=translation_callback)
            
        CurrentService.getServiceName = new_CurrentService_getServiceName
    except Exception as e:
        print("[ArabicEPG] Failed to hook CurrentService.getServiceName: %s" % str(e))

# Load all EPG Hooks
apply_hooks()


class ArabicEPGTranslatorConfig(ConfigListScreen, Screen):
    """
    GUI Screen integrating configuration settings and licensing activation logs.
    Displays: Active License Key, Verified Status, Active Tier, Expiry, and Hardware ID.
    Includes thread-safe keyActivate() helper with asynchronous eTimer verification listener.
    """
    skin = """
    <screen name="ArabicEPGTranslatorConfig" position="center,center" size="640,460" title="Arabic EPG Translator Settings Pro">
        <widget name="config" position="15,15" size="610,300" scrollbarMode="showOnDemand" />
        
        <widget name="status_text" position="15,325" size="610,25" font="Regular;18" halign="left" valign="center" foregroundColor="#00dddd" />
        <widget name="license_status" position="15,350" size="610,25" font="Regular;18" halign="left" valign="center" foregroundColor="#ffcc00" />
        
        <ePixmap pixmap="skin_default/buttons/red.png" position="15,400" size="145,40" alphatest="on" />
        <ePixmap pixmap="skin_default/buttons/green.png" position="170,400" size="145,40" alphatest="on" />
        <ePixmap pixmap="skin_default/buttons/yellow.png" position="325,400" size="145,40" alphatest="on" />
        <ePixmap pixmap="skin_default/buttons/blue.png" position="480,400" size="145,40" alphatest="on" />
        
        <widget name="key_red" position="15,400" zPosition="1" size="145,40" font="Regular;18" halign="center" valign="center" backgroundColor="#9f1313" transparent="1" shadowColor="black" shadowOffset="-1,-1" />
        <widget name="key_green" position="170,400" zPosition="1" size="145,40" font="Regular;18" halign="center" valign="center" backgroundColor="#1f7a1f" transparent="1" shadowColor="black" shadowOffset="-1,-1" />
        <widget name="key_yellow" position="325,400" zPosition="1" size="145,40" font="Regular;18" halign="center" valign="center" backgroundColor="#a1a100" transparent="1" shadowColor="black" shadowOffset="-1,-1" />
        <widget name="key_blue" position="480,400" zPosition="1" size="145,40" font="Regular;18" halign="center" valign="center" backgroundColor="#1f1f7a" transparent="1" shadowColor="black" shadowOffset="-1,-1" />
    </screen>
    """

    def __init__(self, session):
        Screen.__init__(self, session)
        self.session = session

        # Licensing thread communication fields (Strictly Thread-safe Pattern)
        self.activation_thread = None
        self.activation_status = None
        self.activation_success = None
        self.activation_timer = None

        self.list = []
        ConfigListScreen.__init__(self, self.list, session=self.session)
        
        self["key_red"] = Label("Cancel")
        self["key_green"] = Label("Save & Activate")
        self["key_yellow"] = Label("Clear Cache")
        self["key_blue"] = Label("System Stats")
        self["status_text"] = Label("")
        self["license_status"] = Label("")

        self["setupActions"] = ActionMap(["SetupActions", "ColorActions"], {
            "red": self.cancel,
            "green": self.keyActivate,
            "yellow": self.clearCache,
            "blue": self.showInfo,
            "cancel": self.cancel,
            "ok": self.keyActivate
        }, -2)

        self.createConfigList()
        self.update_license_display()

    def createConfigList(self):
        self.list = []
        self.list.append(getConfigListEntry("==== General Translator Options ====", None))
        self.list.append(getConfigListEntry("Enable EPG Translation", config.plugins.arabic_epg.enabled))
        
        if config.plugins.arabic_epg.enabled.value:
            self.list.append(getConfigListEntry("  Translate Program Titles", config.plugins.arabic_epg.translate_title))
            self.list.append(getConfigListEntry("  Translate Short Descriptions", config.plugins.arabic_epg.translate_short))
            self.list.append(getConfigListEntry("  Translate Extended Descriptions", config.plugins.arabic_epg.translate_extended))
            self.list.append(getConfigListEntry("  Translate Channel Names", config.plugins.arabic_epg.translate_channels))
            
            self.list.append(getConfigListEntry("Translation Provider", config.plugins.arabic_epg.provider))
            
            if config.plugins.arabic_epg.provider.value == "DeepL":
                self.list.append(getConfigListEntry("  DeepL API Auth Key", config.plugins.arabic_epg.deepl_key))
            elif config.plugins.arabic_epg.provider.value == "Gemini":
                self.list.append(getConfigListEntry("  Gemini REST API Key", config.plugins.arabic_epg.gemini_key))
        
        self.list.append(getConfigListEntry("==== Commercial Pro License ====", None))
        self.list.append(getConfigListEntry("  License Key", config.plugins.arabic_epg.license_key))
        self.list.append(getConfigListEntry("  License Server URL", config.plugins.arabic_epg.license_server))
        
        self["config"].list = self.list
        self["config"].l.setList(self.list)

    def keyLeft(self):
        ConfigListScreen.keyLeft(self)
        self.createConfigList()

    def keyRight(self):
        ConfigListScreen.keyRight(self)
        self.createConfigList()

    def update_license_display(self):
        """
        Refreshes labels to reflect cached database license values.
        """
        stats = get_stats()
        self["status_text"].setText("Cached database translations: %d items. DB size: %s MB." % (stats["translated_count"], str(stats["cache_size_mb"])))
        
        is_valid, status, data = show_cached_license_status()
        hwid = get_hwid()
        
        if is_valid and data:
            self["license_status"].setText("License status: %s | Tier: %s | Expiry: %s | HWID: %s" % (status, data.get("tier", "Premium"), data.get("expires_at", ""), hwid))
        else:
            self["license_status"].setText("License status: %s | Hardware ID (HWID): %s" % (status, hwid))

    def updateStatusText(self):
        self.update_license_display()

    # -------------------------------------------------------------
    # Thread-Safe Online License Activation (Requested)
    # -------------------------------------------------------------
    def keyActivate(self):
        """
        Saves configurations, then launches background online license activation securely.
        Uses eTimer listener thread-safe check to handle main GUI popup dialog boxes.
        """
        # Save config first
        for x in self["config"].list:
            if x[1] is not None:
                x[1].save()
        config.plugins.arabic_epg.save()
        save_all_caches()

        key = config.plugins.arabic_epg.license_key.value.strip()
        if not key:
            self.session.open(MessageBox, "Please input a commercial license key to activate.", MessageBox.TYPE_ERROR)
            return

        self.activation_status = None
        self.activation_success = None
        
        # Start background timer check
        from enigma import eTimer
        self.activation_timer = eTimer()
        if hasattr(self.activation_timer, "timeout") and hasattr(self.activation_timer.timeout, "connect"):
            self.activation_timer.timeout.connect(self.checkActivationProgress)
        elif hasattr(self.activation_timer, "callback") and hasattr(self.activation_timer.callback, "append"):
            self.activation_timer.callback.append(self.checkActivationProgress)
        else:
            self.activation_timer = None

        if self.activation_timer:
            self.activation_timer.start(100, False) # Non-blocking check every 100ms

        # Spawn background activation thread
        import threading
        def run_activate():
            try:
                hwid = get_hwid()
                server_url = config.plugins.arabic_epg.license_server.value.strip()
                url = "%s/api/license/activate" % server_url
                
                params = {
                    "key": key,
                    "hwid": hwid
                }
                
                import urllib.request
                import urllib.parse
                data = json.dumps(params).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={"Content-Type": "application/json"}
                )
                
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    if res_data.get("success"):
                        # Activation success
                        license_payload = {
                            "key": key,
                            "hwid": hwid,
                            "expires_at": res_data.get("expires_at"),
                            "tier": res_data.get("tier"),
                            "signature": res_data.get("signature")
                        }
                        save_license_cache(license_payload)
                        set_license_valid(True)
                        
                        self.activation_success = True
                        self.activation_status = "Successfully activated %s tier license!" % res_data.get("tier", "Premium")
                    else:
                        self.activation_success = False
                        self.activation_status = res_data.get("error", "Activation refused by licensing server.")
            except Exception as e:
                self.activation_success = False
                self.activation_status = "Connection failed: %s" % str(e)

        self.activation_thread = threading.Thread(target=run_activate)
        self.activation_thread.daemon = True
        self.activation_thread.start()

    def checkActivationProgress(self):
        """
        Triggered periodically to verify activation thread state on the main GUI thread.
        """
        if self.activation_status is not None:
            if self.activation_timer:
                self.activation_timer.stop()
                self.activation_timer = None
                
            self.update_license_display()
            self.createConfigList()
            
            if self.activation_success:
                self.session.open(MessageBox, self.activation_status, MessageBox.TYPE_INFO)
                trigger_screen_refresh()
            else:
                self.session.open(MessageBox, "License activation failed!\n\n%s" % self.activation_status, MessageBox.TYPE_ERROR)

    def save(self):
        for x in self["config"].list:
            if x[1] is not None:
                x[1].save()
        config.plugins.arabic_epg.save()
        save_all_caches()
        self.close()

    def cancel(self):
        for x in self["config"].list:
            if x[1] is not None:
                x[1].cancel()
        self.close()

    def clearCache(self):
        self.session.openWithCallback(
            self.clearCacheConfirm,
            MessageBox,
            "Are you sure you want to clear the entire Arabic translation cache?",
            MessageBox.TYPE_YESNO
        )

    def clearCacheConfirm(self, answer):
        if answer:
            clear_all_caches()
            self.update_license_display()
            self.session.open(MessageBox, "EPG Translation cache database cleared successfully!", MessageBox.TYPE_INFO)

    def showInfo(self):
        stats = get_stats()
        is_valid, status, data = show_cached_license_status()
        
        info_msg = (
            "Arabic EPG Translator Pro v1.0\n\n"
            "Total Cached Translation Entries: %d items\n"
            "Database File Size: %s MB\n"
            "Last Cache Update: %s\n"
            "Device HWID: %s\n"
            "License Status: %s\n\n"
            "Status: System fully synchronized and optimized."
        ) % (stats["translated_count"], str(stats["cache_size_mb"]), stats["last_update"], get_hwid(), status)
        
        self.session.open(MessageBox, info_msg, MessageBox.TYPE_INFO)


# -------------------------------------------------------------
# Enigma2 Startup Session Hooks
# -------------------------------------------------------------
def sessionstart(reason, **kwargs):
    """
    Called upon Enigma2 GUI loading.
    1. Instantly loads and verifies local cached license signature.
    2. Runs silent asynchronous online licensing update in the background.
    """
    global global_session
    if "session" in kwargs and reason == 0:
        global_session = kwargs["session"]
        print("[ArabicEPG] Boot session linked. Initializing licensing checks...")
        
        # 1. Verify and show offline license cache instantly (non-blocking)
        is_valid, status, data = show_cached_license_status()
        if is_valid:
            print("[ArabicEPG] Cached license verified instantly. Translation engine enabled.")
        else:
            print("[ArabicEPG] Cached license state: %s. Awaiting background server status." % status)
            
        # 2. Begin silent online background check
        start_license_check()

def main(session, **kwargs):
    session.open(ArabicEPGTranslatorConfig)

def runManualTranslation(session, **kwargs):
    """
    HandlesExtensions / Blue long-press manual translation.
    """
    try:
        # Check license check first
        if not is_license_valid():
            session.open(MessageBox, "Cannot initiate translation! Please activate your commercial license key.", MessageBox.TYPE_ERROR)
            return

        service = session.nav.getCurrentService()
        if not service:
            session.open(MessageBox, "No active service/channel found to translate.", MessageBox.TYPE_ERROR)
            return
            
        info = service.info()
        event = info and info.getEvent(0)
        if not event:
            session.open(MessageBox, "No active EPG event details available for this channel.", MessageBox.TYPE_ERROR)
            return
            
        title = event.getEventName() or ""
        short_desc = event.getShortDescription() or ""
        extended_desc = event.getExtendedDescription() or ""
        
        if not title and not short_desc and not extended_desc:
            session.open(MessageBox, "EPG details on this channel are empty.", MessageBox.TYPE_INFO)
            return
            
        def manual_callback(original, translated):
            session.open(MessageBox, "Arabic translation fetched and cached successfully!", MessageBox.TYPE_INFO)
            refresh_screens()
            
        if title:
            get_translation(title, cache_type="title", callback=manual_callback)
        if short_desc:
            get_translation(short_desc, cache_type="description", callback=None)
        if extended_desc:
            get_translation(extended_desc, cache_type="description", callback=None)
            
        session.open(MessageBox, "Translation started in background. Refreshing screen shortly...", MessageBox.TYPE_INFO)
        
    except Exception as e:
        session.open(MessageBox, "Manual translation helper failed: " + str(e), MessageBox.TYPE_ERROR)

def Plugins(**kwargs):
    return [
        PluginDescriptor(
            name="Arabic EPG Translator Pro",
            description="Translates EPG event titles and descriptions to Arabic automatically",
            where=PluginDescriptor.WHERE_SESSIONSTART,
            fnc=sessionstart
        ),
        PluginDescriptor(
            name="Arabic EPG Translator Pro",
            description="Configure Arabic EPG Translation settings",
            where=PluginDescriptor.WHERE_PLUGINMENU,
            icon="plugin.png",
            fnc=main
        ),
        PluginDescriptor(
            name="Translate Current Event to Arabic",
            description="Force immediate manual Arabic EPG translation for current program",
            where=PluginDescriptor.WHERE_EXTENSIONSMENU,
            fnc=runManualTranslation
        )
    ]
