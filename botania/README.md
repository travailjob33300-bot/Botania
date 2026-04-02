# 🌿 Botania — Guide de déploiement

Application de planification pour l'entretien de vos plantes.  
Base de données de 90 espèces · Rappels intelligents · Interface mobile-first

---

## 🚀 Démarrage rapide (local)

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer en développement
npm run dev

# 3. Build pour production
npm run build
```

L'app sera disponible sur http://localhost:5173

---

## 📦 Déploiement sur Vercel (recommandé — gratuit)

### Option A : Via l'interface web (le plus simple)

1. Créer un compte sur https://vercel.com
2. Pousser votre projet sur GitHub :
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Botania"
   git branch -M main
   git remote add origin https://github.com/VOTRE_USERNAME/botania.git
   git push -u origin main
   ```
3. Sur Vercel : **"Add New Project"** → importer votre repo GitHub
4. Vercel détecte automatiquement Vite, cliquer **"Deploy"**
5. ✅ Votre app est en ligne en 2 minutes !

### Option B : Via CLI Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Suivre les instructions (login, nom du projet...)
# URL fournie automatiquement : botania.vercel.app
```

---

## 🌐 Déploiement sur Netlify (alternatif — gratuit)

### Option A : Drag & drop (le plus rapide)

```bash
# Builder d'abord
npm run build
```
Puis glisser-déposer le dossier `dist/` sur https://app.netlify.com/drop

### Option B : Via GitHub

1. Pousser sur GitHub (voir étapes ci-dessus)
2. Sur Netlify : **"Add new site"** → **"Import an existing project"**
3. Choisir GitHub → sélectionner le repo `botania`
4. Build settings (déjà configurés dans `netlify.toml`) :
   - Build command : `npm run build`
   - Publish directory : `dist`
5. **"Deploy site"** → URL générée : `botania.netlify.app`

### Option C : Via CLI Netlify

```bash
# Installer Netlify CLI
npm i -g netlify-cli

# Builder
npm run build

# Déployer
netlify deploy --prod --dir=dist
```

---

## 📱 Transformer en Progressive Web App (PWA)

Pour que l'app s'installe comme une vraie app mobile :

```bash
npm install vite-plugin-pwa -D
```

Modifier `vite.config.js` :
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Botania',
        short_name: 'Botania',
        description: 'Planification de vos plantes',
        theme_color: '#0D1810',
        background_color: '#0D1810',
        display: 'standalone',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
})
```

---

## 🔧 Structure du projet

```
botania/
├── public/
│   └── logo.png          ← Votre logo
├── src/
│   ├── data/
│   │   └── plants.js     ← Base de données (90 plantes)
│   ├── App.jsx           ← Application principale
│   └── main.jsx          ← Point d'entrée React
├── index.html
├── vite.config.js
├── vercel.json           ← Config Vercel
├── netlify.toml          ← Config Netlify
└── package.json
```

---

## 🌱 Prochaines étapes suggérées

1. **Météo réelle** → API OpenWeatherMap (gratuit jusqu'à 1000 req/jour)
2. **Base de données cloud** → Supabase (PostgreSQL gratuit)
3. **Authentification** → Supabase Auth (Google, Apple login)
4. **Push notifications** → Firebase Cloud Messaging
5. **App native** → React Native / Expo pour iOS & Android

---

## 💡 URLs utiles

- Vercel : https://vercel.com
- Netlify : https://netlify.com
- GitHub : https://github.com
- OpenWeatherMap : https://openweathermap.org/api
- Supabase : https://supabase.com
