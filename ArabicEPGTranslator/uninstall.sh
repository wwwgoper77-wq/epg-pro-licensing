#!/bin/sh
# Uninstallation script for Arabic EPG Translator Pro Enigma2 plugin
echo "=========================================================="
echo "    Arabic EPG Translator Pro Enigma2 Plugin Uninstaller"
echo "=========================================================="

TARGET_DIR="/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator"

if [ -d "$TARGET_DIR" ]; then
    echo "[+] Removing plugin directory: $TARGET_DIR"
    rm -rf "$TARGET_DIR"
    
    echo "[+] Restarting Enigma2 to apply changes..."
    if [ -f /usr/bin/enigma2 ]; then
        killall -9 enigma2
    else
        echo "[!] Please restart your receiver manually to finish."
    fi
    echo "=========================================================="
    echo "    Arabic EPG Translator Pro uninstalled successfully!"
    echo "=========================================================="
else
    echo "[!] Plugin is not installed at: $TARGET_DIR"
    echo "=========================================================="
fi
