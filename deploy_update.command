#!/bin/bash
echo "Starting Update Process..."
echo "This window will ask you to log in to Google if you haven't already."
echo ""

# Navigate to the project folder
cd "$(dirname "$0")"

# --- CONFIGURATION (One-Time Setup) ---
echo "---------------------------------------------------"
echo "We need to configure your Email settings for the Contact Form."
echo "Please enter your Hostinger Email and Password."
echo "---------------------------------------------------"
read -p "Enter SMTP Email: " smtp_email
read -s -p "Enter SMTP Password: " smtp_password
echo ""
echo "Saving configuration..."

# Write to functions/.env (standard for Firebase V2 functions)
echo "SMTP_EMAIL='$smtp_email'" > functions/.env
echo "SMTP_PASSWORD='$smtp_password'" >> functions/.env

# --- DEPLOYMENT ---
echo ""
echo "Checking Login..."
./node_modules/.bin/firebase login

echo ""
echo "Deploying Updates to Cloud Functions (Project: bakedbybostik-5eb55)..."
# Added --project flag to fix the "No currently active project" error
./node_modules/.bin/firebase deploy --only functions,hosting --project bakedbybostik-5eb55

echo ""
echo "---------------------------------------------------"
echo "Update Complete! You can close this window now."
echo "---------------------------------------------------"
read -p "Press Enter to exit..."
