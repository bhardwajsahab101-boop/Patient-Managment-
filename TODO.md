# TODO - Multi-Clinic Fix

- [ ] Remove duplicate clinic-context middleware from `app.js` and rely only on `middleware/clinicContext.js` `loadClinicContext`.
- [ ] Ensure clinicId is consistently available to views/partials and controllers (req.clinicContext + res.locals.clinicId).
- [ ] Run a quick smoke check: /patients, /dashboard, /reports, /export data for different clinicId.
