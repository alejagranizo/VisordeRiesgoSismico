// Proteger rutas que requieren login (equivale a if (!$_SESSION['usuario']) header Location)
module.exports = (req, res, next) => {
  if (req.session.usuario) return next();
  res.redirect('/login');
};