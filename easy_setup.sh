#!/bin/bash

echo "========================================"
echo "   Baked By Bostik - Easy Setup Tool"
echo "========================================"
echo ""

# 1. Install Dependencies
echo "Step 1: Installing dependencies..."
cd functions
npm install
cd ..
echo "Done."
echo ""

# 2. Login
echo "Step 2: Firebase Login"
echo "A browser window will open. Please log in with your Google account."
echo "If you are already logged in, this will verify it."
npx firebase-tools login
echo "Done."
echo ""

# 3. Hostinger Config
echo "Step 3: Hostinger Email Configuration"
echo "We need to securely save your Hostinger email password to Firebase."
echo "Enter your Hostinger Email Address (e.g. orders@bakedbybostik.com):"
read SMTP_EMAIL
echo "Enter your Hostinger Email Password (hidden):"
read -s SMTP_PASSWORD

if [ ! -z "$SMTP_PASSWORD" ]; then
    echo "Saving credentials..."
    npx firebase-tools functions:config:set smtp.email="$SMTP_EMAIL" smtp.password="$SMTP_PASSWORD"
    echo "Done."
else
    echo "Skipping configuration (password empty)."
fi
echo ""

# 4. Deploy
echo "Step 4: Deploying Cloud Functions"
echo "This may take a few minutes..."
npx firebase-tools deploy --only functions --project bakedbybostik-5eb55

echo ""
echo "========================================"
echo "   SUCCESS! Setup Complete."
echo "   If you need to run this again, use: sh easy_setup.sh"
echo "========================================"
