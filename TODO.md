# Medicine Management Improvements - TODO

## Phase 1: Model Enhancements ✅

- [x] Update `models/medicine.js` - Add category, dosage, manufacturer, expiryDate, batchNumber, description, isActive
- [x] Update `models/stockTransaction.js` - Add patientId, previousStock, newStock
- [x] Update `models/patient.js` - Add medicines array to visits

## Phase 2: Route Enhancements ✅

- [x] Update `routes/medicine.routes.js` - Fix patient dropdown, add detail/edit/delete routes, search/filter

## Phase 3: View Enhancements ✅

- [x] Update `views/medicine/index.ejs` - Search, filters, expiry warnings, edit/delete buttons
- [x] Update `views/medicine/new.ejs` - Additional form fields
- [x] Update `views/medicine/update.ejs` - Fix patient dropdown, show current stock
- [x] Create `views/medicine/detail.ejs` - Medicine detail + stock history
- [x] Create `views/medicine/edit.ejs` - Edit medicine form

## Phase 4: Dashboard Integration ✅

- [x] Update `controllers/dashboard.controller.js` - Add medicine stats queries
- [x] Update `views/Dashboard.ejs` - Display medicine stats cards + quick action

## Phase 5: Patient-Medicine Integration ✅

- [x] Update `controllers/patient.controller.js` - Fetch medicines for forms, process prescriptions, reduce stock, create transactions
- [x] Update `views/NewPatients.ejs` - Medicine selection table with checkboxes and quantities
- [x] Update `views/patients-visits-new.ejs` - Medicine selection when adding visits
- [x] Update `views/patient-detail.ejs` - Show prescribed medicines in visit history

## Phase 6: Testing

- [ ] Test all routes
- [ ] Verify UI rendering
