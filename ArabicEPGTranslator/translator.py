# -*- coding: utf-8 -*-
import os
import json
import urllib.request
import urllib.parse
import threading
import re
from datetime import datetime, timedelta

# Import config from enigma to read provider and key configurations safely
try:
    from Components.config import config
except ImportError:
    # Fallback placeholder for non-enigma environments (e.g. simulation/testing)
    class DummyConfigVal:
        def __init__(self, val=""): self.value = val
    class DummyConfig:
        def __init__(self):
            self.provider = DummyConfigVal("Google")
            self.deepl_key = DummyConfigVal("")
            self.gemini_key = DummyConfigVal("")
            self.license_key = DummyConfigVal("")
            self.license_server = DummyConfigVal("https://ais-dev-62abgaelcwkbp6qhhxg5kp-559956860993.europe-west2.run.app")
    class DummyPlugins:
        def __init__(self): self.arabic_epg = DummyConfig()
    class DummyRoot:
        def __init__(self): self.plugins = DummyPlugins()
    config = DummyRoot()

# License verification state
_license_valid = False

def is_license_valid():
    global _license_valid
    return _license_valid

def set_license_valid(valid):
    global _license_valid
    _license_valid = valid
    print("[ArabicEPG] License validation state changed to: %s" % str(valid))

# Locks for thread-safe operations
cache_lock = threading.Lock()
queue_lock = threading.Lock()
pending_translations = set()

# Paths to separate cache databases
PLUGIN_DIR = os.path.dirname(__file__)
PATH_TITLES = os.path.join(PLUGIN_DIR, "titles.json")
PATH_DESCRIPTIONS = os.path.join(PLUGIN_DIR, "descriptions.json")
PATH_CHANNELS = os.path.join(PLUGIN_DIR, "channels.json")
PATH_CHANNELS_PRESET = os.path.join(PLUGIN_DIR, "channels_translate.json")

# In-memory caches
cache_titles = {}
cache_descriptions = {}
cache_channels = {}
cache_preset_channels = {}

# Offline translation dictionary for common keywords
OFFLINE_DICTIONARY = {
    "movie": "فيلم",
    "film": "فيلم",
    "news": "أخبار",
    "sport": "رياضة",
    "sports": "رياضة",
    "live": "مباشر",
    "football": "كرة القدم",
    "soccer": "كرة القدم",
    "series": "مسلسل",
    "match": "مباراة",
    "drama": "دراما",
    "show": "برنامج",
    "action": "حركة",
    "comedy": "كوميدي",
    "thriller": "تشويق",
    "documentary": "وثائقي",
    "episode": "حلقة",
    "season": "موسم",
    "cartoon": "رسوم متحركة",
    "animation": "رسوم متحركة",
    "music": "موسيقى",
    "weather": "الطقس",
    "cooking": "طبخ",
    "fashion": "موضة",
    "history": "تاريخ",
    "nature": "طبيعة",
    "crime": "جريمة",
    "science": "علوم",
    "family": "عائلي",
    "kids": "أطفال",
    "horror": "رعب",
    "romance": "رومانسي",
    "review": "مراجعة",
    "daily": "يومي",
    "weekly": "أسبوعي",
    "special": "خاص",
    "highlights": "ملخص",
    "final": "النهائي",
    "semi-final": "نصف النهائي"
}

def clean_old_entries(cache_dict, max_days=7):
    """
    Removes entries older than max_days.
    """
    cleaned_dict = {}
    cutoff_date = datetime.now() - timedelta(days=max_days)
    for key, val in cache_dict.items():
        if isinstance(val, dict) and "date" in val:
            try:
                entry_date = datetime.strptime(val["date"], "%Y-%m-%d")
                if entry_date >= cutoff_date:
                    cleaned_dict[key] = val
            except Exception:
                cleaned_dict[key] = val
        else:
            cleaned_dict[key] = {
                "translated": val if isinstance(val, str) else str(val),
                "date": datetime.now().strftime("%Y-%m-%d")
            }
    return cleaned_dict

def load_json_cache(file_path):
    if os.path.exists(file_path):
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                return clean_old_entries(data)
        except Exception as e:
            print("[ArabicEPG] Error loading cache %s: %s" % (os.path.basename(file_path), str(e)))
    return {}

def save_json_cache(file_path, data):
    try:
        with open(file_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print("[ArabicEPG] Error saving cache %s: %s" % (os.path.basename(file_path), str(e)))

def load_all_caches():
    global cache_titles, cache_descriptions, cache_channels, cache_preset_channels
    with cache_lock:
        cache_titles = load_json_cache(PATH_TITLES)
        cache_descriptions = load_json_cache(PATH_DESCRIPTIONS)
        cache_channels = load_json_cache(PATH_CHANNELS)
        
        if os.path.exists(PATH_CHANNELS_PRESET):
            try:
                with open(PATH_CHANNELS_PRESET, "r") as f:
                    cache_preset_channels = json.load(f)
            except Exception:
                cache_preset_channels = {}
        else:
            cache_preset_channels = {}

def save_all_caches():
    with cache_lock:
        save_json_cache(PATH_TITLES, cache_titles)
        save_json_cache(PATH_DESCRIPTIONS, cache_descriptions)
        save_json_cache(PATH_CHANNELS, cache_channels)

# Initialize caches upon loading
load_all_caches()

def get_stats():
    """
    Returns statistic dictionary for the plugin configuration/information screen.
    """
    with cache_lock:
        total_items = len(cache_titles) + len(cache_descriptions) + len(cache_channels)
        
        total_bytes = 0
        for path in [PATH_TITLES, PATH_DESCRIPTIONS, PATH_CHANNELS]:
            if os.path.exists(path):
                total_bytes += os.path.getsize(path)
        
        size_mb = float(total_bytes) / (1024 * 1024)
        
    return {
        "version": "1.0",
        "translated_count": total_items,
        "cache_size_mb": round(size_mb, 3),
        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def clear_all_caches():
    global cache_titles, cache_descriptions, cache_channels
    with cache_lock:
        cache_titles.clear()
        cache_descriptions.clear()
        cache_channels.clear()
        
        for path in [PATH_TITLES, PATH_DESCRIPTIONS, PATH_CHANNELS]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
    save_all_caches()

def is_arabic(text):
    if not text:
        return False
    arabic_pattern = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]')
    return bool(arabic_pattern.search(text))

def translate_offline_text(text):
    cleaned = text.strip().lower()
    
    if cleaned in OFFLINE_DICTIONARY:
        return OFFLINE_DICTIONARY[cleaned]
        
    words = cleaned.split()
    if len(words) <= 4:
        translated_words = []
        fully_translated = True
        for word in words:
            word_clean = re.sub(r'^\W+|\W+$', '', word)
            if word_clean in OFFLINE_DICTIONARY:
                translated_words.append(OFFLINE_DICTIONARY[word_clean])
            else:
                translated_words.append(word)
                fully_translated = False
        
        if fully_translated:
            return " ".join(translated_words)
            
    return None

def translate_deepl(text, api_key):
    try:
        url = "https://api-free.deepl.com/v2/translate"
        if not api_key.endswith(":fx"):
            url = "https://api.deepl.com/v2/translate"
            
        params = {
            "text": text,
            "target_lang": "AR"
        }
        data = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": "DeepL-Auth-Key " + api_key,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if res_data and "translations" in res_data:
                return res_data["translations"][0]["text"]
    except Exception as e:
        print("[ArabicEPG] DeepL Translation Exception: %s" % str(e))
    return None

def translate_gemini(text, api_key):
    try:
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + api_key
        payload = {
            "contents": [{
                "parts": [{
                    "text": "Translate the following TV EPG text to natural, high-quality Arabic. Return ONLY the translated Arabic text with absolutely no explanations, formatting, or extra words:\n\n" + text
                }]
            }]
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if "candidates" in res_data:
                translated = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return translated.strip()
    except Exception as e:
        print("[ArabicEPG] Gemini Translation Exception: %s" % str(e))
    return None

def translate_google(text):
    try:
        url_encoded_text = urllib.parse.quote(text)
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=" + url_encoded_text
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            html = response.read().decode("utf-8")
            data = json.loads(html)
            
            translated_parts = []
            if data and data[0]:
                for part in data[0]:
                    if part and part[0]:
                        translated_parts.append(part[0])
            
            return "".join(translated_parts).strip()
    except Exception as e:
        print("[ArabicEPG] Google Translation Exception: %s" % str(e))
    return None

def fetch_translation_from_provider(text):
    provider = "Google"
    try:
        provider = config.plugins.arabic_epg.provider.value
    except Exception:
        pass
        
    translated = None
    
    if provider == "DeepL":
        try:
            key = config.plugins.arabic_epg.deepl_key.value
            if key:
                translated = translate_deepl(text, key)
        except Exception:
            pass
    elif provider == "Gemini":
        try:
            key = config.plugins.arabic_epg.gemini_key.value
            if key:
                translated = translate_gemini(text, key)
        except Exception:
            pass
            
    if not translated:
        translated = translate_google(text)
        
    return translated

try:
    from queue import PriorityQueue
except ImportError:
    from Queue import PriorityQueue

translation_queue = PriorityQueue()
queue_counter = 0
queue_counter_lock = threading.Lock()

def get_next_counter():
    global queue_counter
    with queue_counter_lock:
        queue_counter += 1
        return queue_counter

PRIORITY_MAP = {
    "channel": 1,
    "title": 2,
    "short_description": 3,
    "description": 4
}

def normalize_channel_name(name):
    suffix = ""
    match = re.search(r'\s+(HD|FHD|UHD|SD|4K|3D|\+\d)$', name, re.IGNORECASE)
    base_name = name
    if match:
        suffix = match.group(0)
        base_name = name[:-len(suffix)].strip()
    
    cleaned_base = re.sub(r'[\+\-\:]', ' ', base_name)
    words = [w for w in re.findall(r'\w+', cleaned_base.lower()) if w not in ('channel', 'tv')]
    return base_name, suffix, words

def find_preset_channel_match(text):
    text_stripped = text.strip()
    if not text_stripped:
        return None
        
    if text_stripped in cache_preset_channels:
        return cache_preset_channels[text_stripped]
    for k, v in cache_preset_channels.items():
        if k.lower() == text_stripped.lower():
            return v
            
    base_input, suffix_input, words_input = normalize_channel_name(text_stripped)
    if not words_input:
        return None
        
    best_match_val = None
    best_score = 0
    
    for preset_key, preset_val in cache_preset_channels.items():
        preset_base, preset_suffix, preset_words = normalize_channel_name(preset_key)
        if not preset_words:
            continue
            
        set_input = set(words_input)
        set_preset = set(preset_words)
        
        intersection = set_input.intersection(set_preset)
        if intersection:
            is_match = False
            if set_input.issubset(set_preset) or set_preset.issubset(set_input):
                is_match = True
            elif len(intersection) >= max(1, min(len(set_input), len(set_preset))):
                is_match = True
                
            if is_match:
                score = len(intersection)
                if score > best_score:
                    best_score = score
                    best_match_val = preset_val
                    
    if best_match_val:
        result = best_match_val
        if suffix_input:
            clean_suffix = suffix_input.strip()
            if not result.strip().lower().endswith(clean_suffix.lower()):
                result = result + suffix_input
        return result
        
    return None

_last_save_time = datetime.now()
_save_lock = threading.Lock()

def debounced_save_cache(cache_type):
    global _last_save_time
    now = datetime.now()
    should_save = False
    
    if translation_queue.empty() or (now - _last_save_time).total_seconds() > 5:
        should_save = True
        
    if should_save:
        with _save_lock:
            _last_save_time = now
            
        cache_copy = None
        with cache_lock:
            if cache_type == "title":
                cache_copy = dict(cache_titles)
            elif cache_type in ("description", "short_description"):
                cache_copy = dict(cache_descriptions)
            elif cache_type == "channel":
                cache_copy = dict(cache_channels)
                
        if cache_copy is not None:
            if cache_type == "title":
                save_json_cache(PATH_TITLES, cache_copy)
            elif cache_type in ("description", "short_description"):
                save_json_cache(PATH_DESCRIPTIONS, cache_copy)
            elif cache_type == "channel":
                save_json_cache(PATH_CHANNELS, cache_copy)

def queue_worker_loop():
    while True:
        try:
            queued_item = translation_queue.get()
            if queued_item is None:
                break
                
            priority, counter, (text, cache_type, callback) = queued_item
            
            # Double check license state before doing any active translation request
            if not is_license_valid():
                with queue_lock:
                    if text in pending_translations:
                        pending_translations.remove(text)
                translation_queue.task_done()
                continue
                
            already_translated = False
            translated = None
            with cache_lock:
                if cache_type == "title" and text in cache_titles:
                    translated = cache_titles[text]["translated"]
                    already_translated = True
                elif cache_type in ("description", "short_description") and text in cache_descriptions:
                    translated = cache_descriptions[text]["translated"]
                    already_translated = True
                elif cache_type == "channel" and text in cache_channels:
                    translated = cache_channels[text]["translated"]
                    already_translated = True
                    
            if already_translated:
                if callback:
                    try:
                        callback(text, translated)
                    except Exception:
                        pass
                with queue_lock:
                    if text in pending_translations:
                        pending_translations.remove(text)
                translation_queue.task_done()
                continue
            
            translated = fetch_translation_from_provider(text)
            
            if translated:
                today_str = datetime.now().strftime("%Y-%m-%d")
                with cache_lock:
                    cache_entry = {
                        "translated": translated,
                        "date": today_str
                    }
                    if cache_type == "title":
                        cache_titles[text] = cache_entry
                    elif cache_type in ("description", "short_description"):
                        cache_descriptions[text] = cache_entry
                    elif cache_type == "channel":
                        cache_channels[text] = cache_entry
                
                debounced_save_cache(cache_type)
                
                if callback:
                    try:
                        callback(text, translated)
                    except Exception as ex:
                        print("[ArabicEPG] Callback Exception: %s" % str(ex))
            
            with queue_lock:
                if text in pending_translations:
                    pending_translations.remove(text)
                    
            translation_queue.task_done()
        except Exception as e:
            print("[ArabicEPG] Queue Worker Exception: %s" % str(e))

# Spawn background worker daemon immediately
worker_thread = threading.Thread(target=queue_worker_loop)
worker_thread.daemon = True
worker_thread.start()

def log_channel_translation(original, normalized, result, final_output):
    try:
        import io
        log_path = "/tmp/ArabicEPGTranslator.log"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            if hasattr(original, 'decode'):
                original = original.decode('utf-8', 'ignore')
            if hasattr(normalized, 'decode'):
                normalized = normalized.decode('utf-8', 'ignore')
            if hasattr(result, 'decode'):
                result = result.decode('utf-8', 'ignore')
            if hasattr(final_output, 'decode'):
                final_output = final_output.decode('utf-8', 'ignore')
        except Exception:
            pass
            
        log_line = (
            u"[%s] Channel Translation Request:\n"
            u"  - Original service name: %s\n"
            u"  - Normalized name: %s\n"
            u"  - Matching result: %s\n"
            u"  - Final Arabic output: %s\n"
            u"----------------------------------------\n"
        ) % (timestamp, original, normalized, result, final_output)
        
        with io.open(log_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print("[ArabicEPG] Failed to write debug log: %s" % str(e))

def get_translation(text, cache_type="title", callback=None):
    """
    Main entry point for translation requests.
    Enforces licensing restriction: Returns original text instantly if license is not active.
    """
    if not text:
        return ""
        
    text_stripped = text.strip()
    if not text_stripped:
        return ""

    # Commercial Licensing Guard: No translation starts unless the license is verified and valid
    if not is_license_valid():
        return text_stripped

    normalized_name = ""
    if cache_type == "channel":
        try:
            base_name, suffix, words = normalize_channel_name(text_stripped)
            normalized_name = base_name
        except Exception:
            normalized_name = text_stripped

    if is_arabic(text_stripped):
        if cache_type == "channel":
            log_channel_translation(text, normalized_name, u"Already Arabic", text_stripped)
        return text_stripped
        
    offline_match = translate_offline_text(text_stripped)
    if offline_match:
        if cache_type == "channel":
            log_channel_translation(text, normalized_name, u"Offline Dictionary Match", offline_match)
        return offline_match
        
    if cache_type == "channel":
        preset_match = find_preset_channel_match(text_stripped)
        if preset_match:
            log_channel_translation(text, normalized_name, u"Preset Channel Match", preset_match)
            return preset_match
                
    with cache_lock:
        if cache_type == "title" and text_stripped in cache_titles:
            return cache_titles[text_stripped]["translated"]
        elif cache_type in ("description", "short_description") and text_stripped in cache_descriptions:
            return cache_descriptions[text_stripped]["translated"]
        elif cache_type == "channel" and text_stripped in cache_channels:
            cached_val = cache_channels[text_stripped]["translated"]
            log_channel_translation(text, normalized_name, u"Dynamic Cache Match", cached_val)
            return cached_val

    with queue_lock:
        if text_stripped not in pending_translations:
            pending_translations.add(text_stripped)
            priority = PRIORITY_MAP.get(cache_type, 3)
            translation_queue.put((priority, get_next_counter(), (text_stripped, cache_type, callback)))
            
    if cache_type == "channel":
        log_channel_translation(text, normalized_name, u"No Match / Queued for Translation", text)
    return text
