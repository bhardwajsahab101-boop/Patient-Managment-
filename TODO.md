# Implementation Plan: Account Activation + Clinic Onboarding Flow

## Completed

- [x] **Step 1: Update User Schema**
  - Added `isActive: { type: Boolean, default: false }`
  - Added `subscriptionEndsAt: { type: Date }`

- [x] **Step 2: Update Auth Middleware**
  - `requireAuth`: check session + user exists
  - `requireActive`: check isActive + subscription expiry
  - `requireClinic`: check clinic exists, redirect to /create-clinic

- [x] **Step 3: Update Signup/Login Routes**
  - Signup: create user with isActive=false, NO auto clinic creation
  - Login: smart redirect based on activation + clinic status

- [x] **Step 4: Create Views**
  - `views/account-pending.ejs` — "Account under review" + WhatsApp support
  - `views/create-clinic.ejs` — Clinic name/location form

- [x] **Step 5: Create Clinic Controller**
  - `controllers/clinic.controller.js` — getCreateClinicForm, createClinic

- [x] **Step 6: Update App Routes**
  - Added /account-pending GET route
  - Added /create-clinic GET/POST routes
  - Added admin activation route
  - Updated dashboard route with requireClinic

- [x] **Step 7: Admin Activation**
  - `routes/admin.routes.js` — PATCH /admin/users/:id/activate

- [x] **Step 8: Update All Protected Routes**
  - `routes/medicine.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/patients.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/dashboard.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/followup.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/reports.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/messages.routes.js` — router.use(requireAuth, requireActive, requireClinic)
  - `routes/support.routes.js` — router.use(requireAuth, requireActive, requireClinic)

## Completed

- [x] Admin Panel UI (`/admin`) with stats, tabs, activate/deactivate, subscription renewal
- [x] Secret Key signup — enter `medicarenew` during signup to become admin
- [x] Sidebar admin link (visible only to admins)
- [x] `.env` stores `SECRET_KEY=medicarenew`
