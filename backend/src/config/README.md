# Firebase Service Account Key

Place your Firebase private key JSON file here, named exactly:

    firebase-service-account.json

## How to get this file:
1. Go to https://console.firebase.google.com/
2. Open your EduTrack project
3. Click the ⚙️ gear icon → **Project Settings**
4. Navigate to the **Service Accounts** tab
5. Select **Node.js** and click **Generate New Private Key**
6. Rename the downloaded file to `firebase-service-account.json`
7. Move it into this folder: `backend/src/config/firebase-service-account.json`

## ⚠️ Security Warning
- This file contains PRIVATE credentials. 
- It is already included in `.gitignore` — DO NOT commit it to GitHub.
- Never share this file publicly.
