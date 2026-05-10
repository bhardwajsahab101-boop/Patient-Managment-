# Plan: Pro multi-clinic dropdown + visibility (with maintainable design)

## Goal

Make Pro users switch clinics using a dropdown, without breaking existing UI.

## Current state (from inspection)

- Many pages fetch clinic via `Clinic.findOne({ ownerId: req.user._id })` (single clinic assumption).
- Medicines already uses `clinicId` query parameter in multiple places.
- Patients/export/reports still assume a single clinic.

## Implementation approach

### 1) Introduce clinic context middleware

- Add a new middleware `middleware/clinicContext.js`:
  - Read `clinicId` from `req.query.clinicId` (dropdown).
  - Validate ownership:
    - clinic must belong to current user.
  - Store in `req.clinicContext` and optionally `res.locals.clinicContext`.
  - If missing, fall back to default clinic (first clinic for owner).

### 2) Provide clinic dropdown UI

- Add an EJS include: `views/include/ClinicSelector.ejs`:
  - If user is Pro: show dropdown.
  - Options populated with all clinics belonging to user.
  - On change: navigate to same route preserving query params + selected `clinicId`.

### 3) Make clinic-scoped data use selected clinicId

Update controllers:

- `controllers/patient.controller.js`
  - Replace internal `getUserClinic()` usage with `req.clinicContext.clinicId`.
- `controllers/reports.controller.js`
  - Filter analytics by selected clinicId.
- `controllers/export.controller.js`
  - Export only selected clinic.

### 4) Keep design consistent

- Use include in existing pages:
  - `views/Dashboard.ejs` (if exists)
  - `views/patients.ejs`
  - `views/reports.ejs`
  - `views/patient-detail.ejs`
  - `views/medicine/index.ejs` (already partially supports clinicId)

### 5) Next features after dropdown

- Staff accounts model + access checks
- Export backup endpoint
- Pro-only UX buttons

## Acceptance criteria

- Pro users can switch clinic using dropdown.
- Data shown (patients, reports, export) changes accordingly.
- Starter users cannot see clinic dropdown.
