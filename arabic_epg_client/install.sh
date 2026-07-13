#!/bin/sh
# ==============================================================================
# Arabic EPG Translator Commercial Edition - Installer Script
# (c) 2026 EPG-PRO Ltd. All rights reserved.
# ==============================================================================

PLUGIN_DIR="/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator"
TMP_DIR="/tmp/arabic_epg_install"

echo "======================================================================"
echo "    ARABIC EPG TRANSLATOR PRO - INSTALLATION"
echo "======================================================================"
echo "-> Detecting Enigma2 architecture..."

# Check Python version
PYVER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "-> Detected Python Version: $PYVER"

# Create plugin destination folder
echo "-> Creating plugin folder at: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

# Copy installation files from tmp or current directory
echo "-> Copying plugin source files..."
if [ -d "$TMP_DIR" ]; then
    cp -r $TMP_DIR/* "$PLUGIN_DIR/"
else
    # Fallback to local copy if run in-place
    cp -f __init__.py "$PLUGIN_DIR/"
    cp -f plugin.py "$PLUGIN_DIR/"
    cp -f translator.py "$PLUGIN_DIR/"
    cp -f install.sh "$PLUGIN_DIR/"
    cp -f uninstall.sh "$PLUGIN_DIR/"
fi

# Set permissions
echo "-> Setting proper permissions..."
chmod -R 755 "$PLUGIN_DIR"

# Precompile python files to speed up load and check for syntax errors
echo "-> Compiling Python bytecode..."
python3 -m compileall "$PLUGIN_DIR"

# Create standard empty cache folder
mkdir -p /etc/enigma2/

echo "----------------------------------------------------------------------"
echo "    INSTALLATION COMPLETED SUCCESSFULLY!"
echo "----------------------------------------------------------------------"
echo "To activate your license key:"
echo "1. Restart your Enigma2 GUI."
echo "2. Go to Menu -> Plugins -> Arabic EPG Translator Settings."
echo "3. Enter your commercial License Key and press the YELLOW button."
echo "----------------------------------------------------------------------"

# Restart GUI safely
read -p "Would you like to restart Enigma2 GUI now to apply changes? (y/n) " resp
if [ "$resp" = "y" ] || [ "$resp" = "Y" ]; then
    echo "-> Restarting Enigma2 GUI..."
    if [ -f /usr/bin/enigma2 ]; then
        # Standard systemd check or direct kill
        if systemctl is-active --quiet enigma2; then
            systemctl restart enigma2
        else
            killall -9 enigma2
        fi
    else
        init 4 && sleep 2 && init 3
    fi
else
    echo "Please restart your receiver GUI manually to load the plugin."
fi

echo "======================================================================"
exit 0
