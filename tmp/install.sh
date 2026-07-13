#!/bin/sh
# ==============================================================================
# Arabic EPG Translator Commercial Edition - Installer Script
# (c) 2026 EPG-PRO Ltd. All rights reserved.
# ==============================================================================

PLUGIN_DIR="/usr/lib/enigma2/python/Plugins/Extensions/EPGPro"
TMP_DIR="/tmp/epg_pro_install"

echo "======================================================================"
echo "    EPG-PRO TRANSLATOR - INSTALLATION"
echo "======================================================================"
echo "-> Detecting Enigma2 architecture..."

# Check Python version safely in both Py2 and Py3
PYVER=$(python -c 'import sys; print("%d.%d" % (sys.version_info[0], sys.version_info[1]))' 2>/dev/null || python3 -c 'import sys; print("%d.%d" % (sys.version_info.major, sys.version_info.minor))')
echo "-> Detected Python Version: $PYVER"

# Create plugin destination folder
echo "-> Creating plugin folder at: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

# Copy installation files from tmp or current directory
echo "-> Copying plugin source files..."
if [ -d "$TMP_DIR" ]; then
    cp -rf $TMP_DIR/* "$PLUGIN_DIR/"
else
    # Fallback to local copy if run in-place
    cp -f __init__.py "$PLUGIN_DIR/" 2>/dev/null
    cp -f plugin.py "$PLUGIN_DIR/" 2>/dev/null
    cp -f translator.py "$PLUGIN_DIR/" 2>/dev/null
    cp -f obfuscate.py "$PLUGIN_DIR/" 2>/dev/null
    cp -f install.sh "$PLUGIN_DIR/" 2>/dev/null
    cp -f uninstall.sh "$PLUGIN_DIR/" 2>/dev/null
fi

# Set permissions
echo "-> Setting proper permissions..."
chmod -R 755 "$PLUGIN_DIR"

# Precompile python files to speed up load and check for syntax errors
echo "-> Compiling Python bytecode..."
python -m compileall "$PLUGIN_DIR" 2>/dev/null || python3 -m compileall "$PLUGIN_DIR" 2>/dev/null

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
if [ -t 0 ]; then
    read -p "Would you like to restart Enigma2 GUI now to apply changes? (y/n) [y]: " resp
    if [ -z "$resp" ]; then
        resp="y"
    fi
else
    resp="y"
fi

if [ "$resp" = "y" ] || [ "$resp" = "Y" ]; then
    echo "-> Restarting Enigma2 GUI..."
    if [ -f /usr/bin/enigma2 ]; then
        if systemctl is-active --quiet enigma2 2>/dev/null; then
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
