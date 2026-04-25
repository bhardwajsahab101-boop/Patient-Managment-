# Route Fix TODO - Multi-tenant User Scoping

- [x] Fix `models/User.js` — remove broken dangling line
- [x] Install `express-session` dependency
- [x] Fix `app.js` — configure session middleware, wire signup routes
- [x] Fix `routes/signup.routes.js` — proper Express router
- [x] Fix `models/patient.js` — make userId/clinicId optional
- [ ] **REQUIRED:** Add `requireAuth` to all protected routes
- [ ] **REQUIRED:** Scope ALL controllers to `req.user._id`
- [ ] **REQUIRED:** Auto-assign `userId` when creating patients
- [ ] **REQUIRED:** Public routes (login/signup) skip auth
