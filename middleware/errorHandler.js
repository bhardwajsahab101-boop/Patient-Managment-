export function errorHandler(err, req, res, next) {
  console.error(err);

  res.status(500).render("error", {
    err,
  });
}
