# EPG-PRO Translation Licensing System

EPG-PRO is a high-performance, unified, full-stack licensing server and corresponding Enigma2 Python 3 translator client plugin. It enables you to monetize and manage Enigma2 translation clients with secure, cryptographically signed licenses, offline grace periods, hardware unbinding, and active telemetry logs.

---

## 📂 Project Structure Overview

This repository is organized to be clean, production-ready, and easy to maintain:

```text
├── .dockerignore           # Production Docker ignore rules
├── .env.example             # Documented example environment configuration
├── ADMIN_GUIDE.md          # Guide for administrating keys via the React panel
├── API.md                  # Comprehensive technical API definitions for receivers
├── DEPLOYMENT.md           # Deployment manual (Cloud Run, Railway, Render)
├── Dockerfile              # Optimized, secure multi-stage Docker build pipeline
├── FINAL_RELEASE.md        # Comprehensive technical specifications & notes
├── RELEASE_CHECKLIST.md    # Actionable step-by-step launch checklist
├── package.json            # Scripts, node dependencies, and bundler configurations
├── server.ts               # Secure, production-tested Express.js backend server
├── obfuscate.py            # Automated build script that injects variables & compiles the client
├── licenses.json           # Template offline/local licensing database store
├── test_licensing.py       # Full-suite offline/online integration test suite
├── src/                    # Administration UI React + Tailwind + Motion source files
└── arabic_epg_client/      # Uncompiled client plugin sources (Enigma2 Python 3)
```

---

## 🚀 Quick Start Guide

### 1. Build and Run Server Locally
Confirm that everything works perfectly out of the box. Run:
```bash
# Install dependencies
npm install

# Compile both client-side dashboard and backend server
npm run build

# Start the full-stack server
npm run start
```
By default, the server will load configurations from `.env` and serve the login portal on `http://localhost:3000`.

### 2. Verify Your System via Integration Tests
We have built a 100% compliant integration suite that tests the entire license lifecycle (creation, unbinding, signature verification, expiration, and revoking) in an automated, sandbox-safe way.
Run the test suite:
```bash
python3 test_licensing.py
```

### 3. Build & Obfuscate Client Plugin
The build process is fully automated. You do not need to modify any Python code. Just write your target server and cryptographic keys into `.env` (as specified in `.env.example`), and execute:
```bash
python3 obfuscate.py
```
This automatically compiles, obfuscates, and packages the client into a single release-ready archive: `arabic_epg_protected.zip`.

---

## 📘 Documentation Guides

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md): Read this before going live. It details each step from initial launch to first client activation.
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md): Admin panel guidelines explaining how to generate, revoke, or unbind customer keys.
- [DEPLOYMENT.md](./DEPLOYMENT.md): Detailed hosting integration steps for Railway, Render, and Google Cloud Run.
- [API.md](./API.md): Technical references on license endpoints, parameters, and cryptographic signatures.
