================================================================
  HiddenTrails.AI 
  Setup & Execution Guide for VM Desktop
================================================================


-------------------------------------------------------------------
1. PROJECT OVERVIEW
-------------------------------------------------------------------

HiddenTrails.AI is a full-stack web application that generates
AI-powered travel itineraries, verifies photo challenges using
GPS and vision AI, and rewards eco-conscious travellers with
points and coupons.

Users can plan trips to any destination, get a personalized
day-by-day itinerary, visit real-world landmarks, snap photos
to earn points, level up, and redeem coupons.

-------------------------------------------------------------------
2. FEATURES
-------------------------------------------------------------------

* AI-generated day-by-day travel itineraries (Groq LLaMA 3.1)
* AI travel chatbot with session memory
* GPS + Vision AI photo challenge verification
* Reward system with points, levels, and coupons
* Firebase Firestore as the database (no SQL setup needed)
* Wikipedia API for destination images
* User authentication via Firebase Auth

-------------------------------------------------------------------
3. TECH STACK
-------------------------------------------------------------------

Frontend  : HTML, CSS, JavaScript
Backend   : Node.js, Express.js 5
AI        : Groq API (LLaMA 3.1-8b-instant + LLaMA 4 Scout vision)
Database  : Firebase Firestore (Admin SDK)
Images    : Wikipedia REST API

-------------------------------------------------------------------
4. PROJECT STRUCTURE
-------------------------------------------------------------------

HiddenTrails.AI/
│
├── index.html              ← Landing / login page
├── auth.html               ← Authentication page
├── dashboard.html          ← User dashboard
├── plantrips.html          ← Trip planning page
├── itinerary.html          ← Generated itinerary view
├── photo-challenge.html    ← GPS + photo verification
├── rewards.html            ← Rewards & leveling
├── saved.html              ← Saved trips
├── my-trips.html           ← Past trips
├── upload-gem.html         ← Upload hidden gems
├── signup.html             ← Sign-up page
├── admin.html              ← Admin panel
│
├── package.json            ← Frontend dependency (ssl-root-cas)
│
└── backend/
    ├── server.js           ← Express entry point (PORT 5000)
    ├── .env                ← Environment variables (API keys)
    │
    ├── config/
    │   ├── firebase.js              ← Firebase Admin SDK init
    │   ├── groq.js                  ← Groq API keys & model IDs
    │   ├── constants.js             ← Business-logic thresholds
    │   └── serviceAccountKey.json  ← Firebase credentials (private)
    │
    ├── routes/
    │   ├── itineraryRoutes.js   ← POST /generate-itinerary
    │   ├── chatbotRoutes.js     ← POST /chat, POST /chat/clear
    │   ├── photoRoutes.js       ← POST /verify-photo
    │   ├── imageRoutes.js       ← GET  /get-destination-image
    │   ├── rewardRoutes.js      ← GET/POST /rewards
    │   ├── couponRoutes.js      ← GET/POST /coupons
    │   └── adminRoutes.js       ← CRUD /admin/places
    │
    ├── controllers/         ← Request handlers
    ├── services/            ← Business logic (AI, GPS, rewards)
    ├── middleware/          ← Error handler, request logger
    └── utils/               ← GPS validator, haversine, level calc


-------------------------------------------------------------------
5. PREREQUISITES
-------------------------------------------------------------------

Make sure the following are installed on the VM:

  1. Node.js  >= 18.x   (required for native fetch + ESM support)
  2. npm      >= 9.x    (comes bundled with Node.js)
  3. A modern browser   (Chrome / Edge / Firefox)

To verify installed versions, open a terminal and run:

    node --version       ← should show v18.x or higher
    npm --version        ← should show 9.x or higher

If Node.js is not installed or below v18, download it from:
    https://nodejs.org/en/download


-------------------------------------------------------------------
6. SETUP & EXECUTION STEPS
-------------------------------------------------------------------

IMPORTANT: Follow steps in order. Do NOT skip any step.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 1 — EXTRACT THE PROJECT
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

If the project zip file is on the VM desktop:

  1. Right-click zip.zip
  2. Select "Extract Here"
  3. The folder HiddenTrails.AI/ will appear on the desktop

If the folder is already extracted, skip to Step 2.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 2 — VERIFY ENVIRONMENT VARIABLES (.env)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

The .env file is located at:

    HiddenTrails.AI/backend/.env

It should already be present and contain:

    GROQ_API_KEY=YOUR_GROQ_API_KEY
    ADMIN_KEY=YOUR_ADMIN_KEY

If the file is missing, create it manually at that path and
paste the above two lines into it.

If the Groq API key stops working (keys can expire), get a new
free key at:
    https://console.groq.com/keys

Then replace the GROQ_API_KEY value in the .env file.

DO NOT share or commit the .env file to version control.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 3 — VERIFY FIREBASE SERVICE ACCOUNT
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

The Firebase credentials file is located at:

    HiddenTrails.AI/backend/config/serviceAccountKey.json

This file should already be present in the project zip.
The server will refuse to start if this file is missing.

If it is missing:
  1. Go to https://console.firebase.google.com
  2. Open the project → Project Settings → Service Accounts
  3. Click "Generate New Private Key"
  4. Save the downloaded JSON as:
         HiddenTrails.AI/backend/config/serviceAccountKey.json

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 4 — INSTALL BACKEND DEPENDENCIES
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Open a terminal and run the following commands:

    cd HiddenTrails.AI/backend
    npm install

This installs: express, firebase-admin, dotenv, cors,
node-fetch, and sharp.

Expected output: "added N packages"
Time: ~30–60 seconds depending on network speed.

NOTE: The project zip already includes node_modules, so
npm install may be very fast (just verifying dependencies).

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 5 — START THE BACKEND SERVER
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

From the same terminal (inside HiddenTrails.AI/backend/):

    node server.js

    OR:

    npm start

Expected output on success:

    Firebase Admin initialized successfully
    HiddenTrails.AI backend running on http://localhost:5000
    API Endpoints:
       POST /generate-itinerary
       POST /chat
       POST /verify-photo
       ...

The server runs on: http://localhost:5000

To confirm it is working, open a browser and visit:
    http://localhost:5000/health

You should see:
    { "status": "healthy", "service": "HiddenTrails.AI Backend" }

Keep this terminal open while using the app.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 6 — OPEN THE FRONTEND
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

The backend serves the frontend as static files automatically.

Simply open a browser and visit:
    http://localhost:5000

This loads index.html automatically. No separate frontend
server or build step is needed.

ALTERNATIVELY, if using VS Code with Live Server extension:
  - Right-click index.html → "Open with Live Server"
  - The frontend will connect to backend at port 5000

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
STEP 7 — USE THE APPLICATION
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  1. Open http://localhost:5000 in the browser
  2. Sign up for a new account or log in
  3. Plan a trip by entering a destination and interests
  4. View your AI-generated itinerary
  5. Use the photo challenge to earn points at real landmarks
  6. Redeem coupons from the rewards page


-------------------------------------------------------------------
7. KEY API ENDPOINTS
-------------------------------------------------------------------

  GET  /health                  → Server health check
  POST /generate-itinerary      → Generate AI travel itinerary
                                  Body: { destination, days,
                                          interests, userId }
  POST /chat                    → AI travel chatbot
                                  Body: { message, sessionId }
  POST /chat/clear              → Clear chatbot session memory
                                  Body: { sessionId }
  POST /verify-photo            → Verify photo challenge
                                  Body: { image (base64),
                                          gpsData, challengeId,
                                          userId }
  GET  /get-destination-image   → Fetch destination image
                                  Query: ?destination=Paris
  GET  /rewards/:userId         → Get user rewards and level
  POST /rewards/claim-trip      → Claim trip reward
                                  Body: { userId, tripData }
  GET  /coupons                 → List available coupons
  POST /coupon/redeem           → Redeem a coupon
                                  Body: { userId, couponId }
  GET  /admin/places            → List places (needs ADMIN_KEY)
  POST /admin/places            → Add a new place


-------------------------------------------------------------------
8. LEVEL THRESHOLDS
-------------------------------------------------------------------

  Rookie         :    0 –  199 points
  Explorer       :  200 –  499 points
  Adventurer     :  500 –  999 points
  Pro Traveler   : 1000 – 1999 points
  Legend         : 2000+ points

Points are earned per trip: formula is 50 × log(distance in km).
Daily cap: 1 trip reward / 200 points per day.
Monthly cap: 1000 points.
Coupons can be redeemed once you reach 500+ points.



-------------------------------------------------------------------
9. COMMON ISSUES & FIXES
-------------------------------------------------------------------

Problem : Server fails to start —
          "serviceAccountKey.json not found"
Fix     : Place the Firebase service account JSON at:
          HiddenTrails.AI/backend/config/serviceAccountKey.json

Problem : Server fails to start —
          "GROQ_API_KEY not found"
Fix     : Check that backend/.env exists and contains:
          GROQ_API_KEY=your_key_here

Problem : Port 5000 already in use
Fix     : Stop the other process using port 5000, OR add this
          line to backend/.env:
              PORT=5001
          Then access the app at http://localhost:5001

Problem : npm install fails
Fix     : Ensure Node.js >= 18 is installed.
          Run: node --version  (should show v18.x or higher)
          Try: npm install --legacy-peer-deps

Problem : "Cannot use import statement" error
Fix     : The backend uses ES Modules. Ensure you are running
          Node.js 18+ and that backend/package.json has:
              "type": "module"

Problem : CORS errors in the browser console
Fix     : Make sure the backend server is running at
          http://localhost:5000 before opening the frontend.

Problem : AI features not working (itinerary/chatbot)
Fix     : Check that the GROQ_API_KEY in backend/.env is valid.
          Get a new free key at https://console.groq.com/keys
          An active internet connection is required.

Problem : Photo challenge not verifying (GPS error)
Fix     : Allow location permissions in the browser when
          prompted. The photo challenge requires real GPS
          coordinates from the browser.

Problem : Sharp warnings during npm install
Fix     : Sharp may warn about platform-specific binaries on
          first install — this is normal and non-fatal.
          The server will still start and work correctly.

================================================================
  END OF README
================================================================
