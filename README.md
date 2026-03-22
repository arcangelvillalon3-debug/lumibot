# 🦉 LumiBot — Guía de Deploy Completa

## Stack Tecnológico
- **Frontend**: HTML/CSS/JS puro (sin frameworks, carga ultrarrápida)
- **Backend**: Node.js + Express + Socket.io
- **Deploy Frontend**: Vercel (gratis)
- **Deploy Backend**: Railway (~$5/mes para Socket.io en tiempo real)
- **Base de datos**: Supabase (gratis tier)
- **Pagos**: Stripe ($5/mes suscripción)
- **Dominio**: lumibot.app (~$12/año)

---

## 🚀 PASO 1 — Subir a GitHub

```bash
cd lumibot
git init
git add .
git commit -m "🦉 LumiBot v1.0 - Launch"
git remote add origin https://github.com/TU_USUARIO/lumibot.git
git push -u origin main
```

---

## 🌐 PASO 2 — Deploy en Vercel (Frontend + API)

1. Ve a **vercel.com** → "Add New Project"
2. Importa tu repositorio de GitHub
3. En **Environment Variables**, agrega:
   ```
   ANTHROPIC_API_KEY = tu_key_de_anthropic
   ```
4. Click **Deploy** — listo en 2 minutos ✅

Tu app estará en: `lumibot.vercel.app`

---

## ⚡ PASO 3 — Deploy en Railway (Socket.io Multijugador)

1. Ve a **railway.app** → "New Project" → "Deploy from GitHub"
2. Selecciona tu repo
3. Agrega variables de entorno:
   ```
   PORT = 3000
   ANTHROPIC_API_KEY = tu_key
   NODE_ENV = production
   ```
4. Railway genera URL tipo: `lumibot-server.railway.app`
5. En tu `index.html`, cambia la línea del socket:
   ```javascript
   const serverUrl = 'https://lumibot-server.railway.app';
   ```

---

## 🗄️ PASO 4 — Supabase (Base de Datos)

1. Ve a **supabase.com** → "New Project"
2. Crea estas tablas:

```sql
-- Usuarios y puntos
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  pts INTEGER DEFAULT 0,
  is_pro BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Galería de pixel art
CREATE TABLE pixel_gallery (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  data JSONB,
  size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de batallas
CREATE TABLE battles (
  id SERIAL PRIMARY KEY,
  room_code TEXT,
  winner_id TEXT,
  players JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. Copia `SUPABASE_URL` y `SUPABASE_ANON_KEY` a tus variables de entorno.

---

## 💳 PASO 5 — Stripe (Pagos $5/mes)

1. Ve a **dashboard.stripe.com**
2. Crea un producto "LumiBot Pro" → Precio recurrente $5/mes
3. Instala Stripe en tu servidor:
   ```bash
   npm install stripe
   ```
4. Agrega endpoint de checkout en `server.js`:
   ```javascript
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   
   app.post('/api/create-checkout', async (req, res) => {
     const session = await stripe.checkout.sessions.create({
       mode: 'subscription',
       payment_method_types: ['card'],
       line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
       success_url: 'https://lumibot.app?pro=1',
       cancel_url: 'https://lumibot.app',
     });
     res.json({ url: session.url });
   });
   ```
5. En el frontend, reemplaza `activatePro()` por:
   ```javascript
   async function activatePro() {
     const res = await fetch('/api/create-checkout', { method: 'POST' });
     const { url } = await res.json();
     window.location.href = url;
   }
   ```

---

## 🌍 PASO 6 — Dominio lumibot.app

1. Registra `lumibot.app` en **namecheap.com** (~$12/año)
2. En Vercel → Settings → Domains → Add `lumibot.app`
3. En Namecheap → DNS → Apunta a los nameservers de Vercel
4. SSL automático incluido ✅

---

## 📊 Proyección de Ingresos

| Usuarios Gratis | Conversión (3%) | Pro $5/mes | Ingreso Mensual |
|-----------------|-----------------|------------|-----------------|
| 500             | 15              | $5         | **$75/mes**     |
| 2,000           | 60              | $5         | **$300/mes**    |
| 10,000          | 300             | $5         | **$1,500/mes**  |
| 50,000          | 1,500           | $5         | **$7,500/mes**  |

### Estrategia de crecimiento:
1. **Mes 1-2**: Launch gratuito → redes sociales de padres y maestros
2. **Mes 3**: SEO → "tutor IA para niños gratis"
3. **Mes 4**: Alianzas con escuelas (licencia institucional $50/mes)
4. **Mes 6**: Android/iOS con Capacitor.js (mismo código, sin reescribir)

---

## 🛡️ COPPA / Privacidad (importante para niños)

- No recopilar datos personales de menores sin consentimiento parental
- Política de privacidad clara en `lumibot.app/privacidad`
- Los datos del panel de padres deben ser accesibles y eliminables

---

## 📱 Convertir a App Móvil (opcional)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init LumiBot com.lumibot.app
npx cap add android
npx cap add ios
npx cap sync
npx cap open android  # Abre Android Studio
```

---

**¡Listo para conquistar el mundo! 🌍🦉**    
DEPLOY V1
