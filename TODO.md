# TODO

- [ ] Add memory-safe export behavior in `controllers/export.controller.js`:
  - [ ] Replace `exportClinicData` (single big JSON stringify) with streamed/safer approach or redirect to ZIP export.
  - [ ] Make `exportClinicBackupZip` avoid holding entire arrays for JSON stringify (chunk/stream JSON building).
  - [ ] Add hard limits / pagination or streaming for patients/medicines.
- [ ] Reduce report aggregation memory usage in `controllers/reports.controller.js`:
  - [ ] Guard `from/to` range and disable `fillMissingDates` expansion for very large ranges.
  - [ ] Reduce number of `$unwind` pipelines; apply date filters earlier when possible.
- [ ] After code changes: run node server with increased heap for verification.
