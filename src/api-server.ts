import express from "express";

const app = express();

// Middleware for JSON
app.use(express.json());

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/notify-admin", (req, res) => {
  const { userEmail, planId, userName } = req.body;
  
  // In a real app, you would use a service like SendGrid or Mailgun here
  console.log(`[EMAIL SIMULATION] To: mizael.org.silva@gmail.com`);
  console.log(`[EMAIL SIMULATION] Subject: Nova solicitação de acesso - ProCurrículo`);
  console.log(`[EMAIL SIMULATION] Body: O usuário ${userName} (${userEmail}) solicitou acesso ao plano ${planId}.`);
  console.log(`[EMAIL SIMULATION] Link de Aprovação: ${process.env.APP_URL || 'http://localhost:3000'}`);
  
  res.json({ success: true, message: "Admin notificado com sucesso." });
});

export default app;
