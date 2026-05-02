import { body, validationResult } from "express-validator";

export const validatePatient = [
  body("patient.name")
    .trim()
    .notEmpty()
    .withMessage("Name required")
    .isLength({ max: 100 })
    .withMessage("Name too long"),
  body("patient.phone")
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage("Valid 10-digit phone required"),
  body("patient.age").optional().isInt({ min: 0, max: 120 }),
  body("patient.gender").optional().isIn(["Male", "Female", "Other"]),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.validationErrors = errors.array();
      return next();
    }
    next();
  },
];

export const validateVisit = [
  body("visit.notes").optional().trim().escape(),
  body("visit.totalPayment").optional().isFloat({ min: 0 }),
  body("visit.paidPayment").optional().isFloat({ min: 0 }),
  body("visit.nextVisit").optional().isISO8601().toDate(),
];
