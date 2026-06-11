const express    = require('express');
const bcrypt     = require('bcrypt');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const router     = express.Router();
const User       = require('../models/User');
const path = require('path');

// Configurar transporter con credenciales del .env
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: false,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  tls: { rejectUnauthorized: false }
});

// GET /login
router.get('/login', (req, res) => {
  res.sendFile('login.html', { root: './public' });
});

// GET /register
router.get('/register', (req, res) => {
  res.sendFile('register.html', { root: './public' });
});

// POST /register
router.post('/register', async (req, res) => {
  const { usuario, password, email, name, lastName, institution } = req.body;

  try {
    const hash          = await bcrypt.hash(password, 10);
    const emailToken    = crypto.randomBytes(32).toString('hex');
    const approvalToken = crypto.randomBytes(32).toString('hex');

    await User.create({
      usuario: usuario, 
      password: hash, email, name, lastName, institution,
      status: 'pending',
      emailVerified: false,
      emailToken,
      approvalToken
    });

    const base = process.env.APP_URL;

    // Email 1: verificación al usuario
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: 'Risk Seismic Viewer - Verify your email',
        html: `
          <p>Hello ${name},</p>
          <p>Thank you for registering with Risk Seismic Viewer. Please verify your account by clicking the link:</p>
          <a href="${base}/verify-email?token=${emailToken}">Verify Email</a>
          <p>After verification, your registration will be reviewed by our team. You will receive another email once your account is approved.</p>
          <p>If you did not register, please ignore this message.</p>

          <p> Best regards,<br/>Risk Seismic Viewer Team</p>
          <div style="text-align:left; margin-bottom:20px;">
            <img src="cid:logo_terra" alt="TERRA" style="height:100px;" />
            <img src="cid:logo_upm" alt="UPM" style="height:80px;" />
          </div>
        `,
        attachments: [
          {
            filename: 'LogoTERRA.png',
            path: path.join(__dirname, '../public/css/LogoTERRA.png'),
            cid: 'logo_terra'
          },
          {
            filename: 'Logo-UPM-Nombre.png',
            path: path.join(__dirname, '../public/css/Logo-UPM-Nombre.png'),
            cid: 'logo_upm'
          }
        ]
      });
    } catch (mailErr) {
      console.error('Error sending verification email:', mailErr.message);
    }

    // Email 2: notificación al técnico
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: process.env.TECH_EMAIL,
        subject: `Risk Seismic Viewer - New registration: ${usuario}`,
        html: `
          <p>New user pending approval:</p>
          <ul>
            <li><strong>Username:</strong> ${usuario}</li>
            <li><strong>Name:</strong> ${name} ${lastName}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Institution:</strong> ${institution}</li>
          </ul>
          <p>
            <a href="${base}/approve?token=${approvalToken}&action=approve"
               style="background:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;margin-right:10px">
              Aprobar
            </a>
            &nbsp;&nbsp;
            <a href="${base}/approve?token=${approvalToken}&action=reject"
               style="background:#dc3545;color:white;padding:10px 20px;text-decoration:none;border-radius:4px">
              Rechazar
            </a>
          </p>
        `
      });
    } catch (mailErr) {
      console.error('Error sending approval email:', mailErr.message);
    }

  res.redirect(`/login?msg=pending&email=${encodeURIComponent(email)}`);
  
  } catch (err) {
    console.error('Error en registro:', err);
    if (err.code === 11000) {
      res.redirect('/register?error=exists');
    } else {
      res.redirect('/register?error=db');
    }
  }
});

// GET /verify-email
router.get('/verify-email', async (req, res) => {
  try {
    const user = await User.findOne({ emailToken: req.query.token });
    if (!user) return res.send('Token invalid o expired.');
    user.emailVerified = true;
    user.emailToken    = null;
    await user.save();
    res.redirect('/login?msg=verified');
  } catch {
    res.send('Error verifying email.');
  }
});

// GET /approve
router.get('/approve', async (req, res) => {
  try {
    const user = await User.findOne({ approvalToken: req.query.token });
    if (!user) return res.send('Token invalido o ya usado.');

    user.status        = req.query.action === 'approve' ? 'active' : 'rejected';
    user.approvalToken = null;
    await user.save();

    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: user.email,
        subject: 'Risk Seismic Viewer - Account status updated',
        html: `
          ${user.status === 'active'
            ? `<p>Your account has been approved. You can now <a href="${process.env.APP_URL}/login">log in</a>.</p>`
            : `<p>Your registration request has been rejected. Contact the team if you think this is an error.</p>`
          }
          <p> Best regards,<br/>Risk Seismic Viewer Team</p>
          <div style="text-align:left; margin-bottom:20px;">
            <img src="cid:logo_terra" alt="TERRA" style="height:100px;" />
            <img src="cid:logo_upm" alt="UPM" style="height:80px;" />
          </div>
        `,
        attachments: [
          {
            filename: 'LogoTERRA.png',
            path: path.join(__dirname, '../public/css/LogoTERRA.png'),
            cid: 'logo_terra'
          },
          {
            filename: 'Logo-UPM-Nombre.png',
            path: path.join(__dirname, '../public/css/Logo-UPM-Nombre.png'),
            cid: 'logo_upm'
          }
        ]
      });
    } catch (mailErr) {
      console.error('Error sending status update email:', mailErr.message);
    }

    res.send(`User <strong>${user.usuario}</strong> ${user.status === 'active' ? 'approved ✅' : 'rejected ❌'} successfully.`);
  } catch {
    res.send('Error processing the request.');
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const user = await User.findOne({ usuario });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.redirect('/login?error=1');
    if (!user.emailVerified)
      return res.redirect('/login?error=email');
    if (user.status === 'rejected')
      return res.redirect('/login?error=rejected');
    if (user.status !== 'active')
      return res.redirect('/login?error=pending');
    req.session.usuario = user.usuario;
    res.redirect('/');
  } catch {
    res.redirect('/login?error=db');
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// GET /me
router.get('/me', (req, res) => {
  if (!req.session.usuario)
    return res.status(401).json({ error: 'No autorizado' });
  res.json({ usuario: req.session.usuario });
});

module.exports = router;