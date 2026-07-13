#!/bin/sh
# ==============================================================================
# Arabic EPG Translator Commercial Edition - Uninstaller Script
# (c) 2026 EPG-PRO Ltd. All rights reserved.
# ==============================================================================

PLUGIN_DIR="/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator"
LICENSE_FILE="/etc/enigma2/arabic_epg.lic"

echo "======================================================================"
echo "    ARABIC EPG TRANSLATOR PRO - UNINSTALLATION"
echo "======================================================================"

# Check if plugin is installed
if [ ! -d "$PLUGIN_DIR" ]; then
    echo "[!] Plugin folder not found. It may have already been removed."
else
    echo "-> Removing plugin files..."
    rm -rf "$PLUGIN_DIR"
    echo "-> Plugin removed successfully."
fi

# Ask to delete license cache
if [ -f "$LICENSE_FILE" ]; then
    read -p "Do you want to delete your license key and activation cache? (y/n) [n]: " del_lic
    if [ "$del_lic" = "y" ] || [ "$del_lic" = "Y" ]; then
        echo "-> Deleting license cache: $LICENSE_FILE"
        rm -f "$LICENSE_FILE"
        echo "-> License key wiped from receiver."
    else
        echo "-> Preserving license cache for future re-installations."
    fi
fi

echo "----------------------------------------------------------------------"
echo "    UNINSTALLATION PROCESS COMPLETED!"
echo "----------------------------------------------------------------------"

# Restart GUI safely
read -p "Would you like to restart Enigma2 GUI now to clear memory? (y/n) " resp
if [ "$resp" = "y" ] || [ "$resp" = "Y" ]; then
    echo "-> Restarting Enigma2 GUI..."
    if [ -f /usr/bin/enigma2 ]; then
        if systemctl is-active --quiet enigma2; then
            systemctl restart enigma2
        else
            killall -9 enigma2
        fi
    else
        init 4 && sleep 2 && init 3
    fi
else
    echo "Please restart your receiver GUI manually to finalize clean up."
fi

echo "======================================================================"
exit 0
