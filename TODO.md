# Fix express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR

## Steps
- [x] Edit `app.js` to add `app.set('trust proxy', 1)` before rate limiter
- [x] Make trust proxy configurable via env var
- [ ] Restart server and verify fix

