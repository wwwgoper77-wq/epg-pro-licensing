#!/bin/sh
# Installation script for Arabic EPG Translator Pro Enigma2 plugin
echo "=========================================================="
echo "    Arabic EPG Translator Pro Enigma2 Plugin Installer"
echo "=========================================================="

TARGET_DIR="/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator"

echo "[+] Creating directory structure..."
mkdir -p "$TARGET_DIR"

echo "[+] Copying plugin files..."
cp -rf ./* "$TARGET_DIR/" 2>/dev/null

echo "[+] Setting executable permissions (755)..."
chmod -R 755 "$TARGET_DIR"

# Clean up installer script from target directory so it doesn't clutter the plugin folder
rm -f "$TARGET_DIR/install.sh"

echo "[+] Restarting Enigma2 to apply changes..."
if [ -f /usr/bin/enigma2 ]; then
    echo "[+] Restarting Enigma2..."
    killall -9 enigma2
else
    echo "[!] Enigma2 binary not found. Please restart your receiver manually."
fi

echo "=========================================================="
echo "    Installation completed successfully!"
echo "=========================================================="
