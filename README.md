# Kirghizistan 2026 — App de planification du groupe

Stack : **Vite + React + Supabase** · Déployable sur Vercel gratuitement.

---

## 🚀 Setup en ~10 minutes

### 1. Supabase (base de données)

1. Créer un compte sur [supabase.com](https://supabase.com) (gratuit)
2. **New project** → donner un nom, choisir une région proche (ex: `eu-west-1`)
3. Une fois créé : **SQL Editor** → coller le contenu de `supabase_setup.sql` → **Run**
4. **Settings → API** → copier :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 2. Variables d'environnement

```bash
cp .env.example .env.local
# Éditer .env.local avec tes valeurs Supabase
```

### 3. Dev local

```bash
npm install
npm run dev
# → http://localhost:5173
```

### 4. Déploiement Vercel

```bash
npm install -g vercel   # si pas déjà installé
vercel                  # login + déploiement guidé
```

Dans Vercel dashboard → **Settings → Environment Variables** → ajouter :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puis **Redeploy**. Le lien Vercel est permanent — tu peux le partager avec les 7 autres.

---

## 🤖 Utiliser Claude Code pour modifier l'app

```bash
# Dans le dossier du projet :
claude

# Exemples de ce que tu peux demander :
# "Ajoute un onglet Budget avec un tableau de dépenses par personne"
# "Ajoute une carte Leaflet pour visualiser l'itinéraire"
# "Ajoute des notifications quand quelqu'un modifie l'itinéraire"
```

Claude Code lit le code existant et fait les modifications directement dans les fichiers.

---

## 📁 Structure

```
src/
  main.jsx        → entry point React
  App.jsx         → toute l'app (composant principal)
  supabase.js     → client Supabase + helpers kvGet/kvSet/kvSubscribe
supabase_setup.sql → migration SQL à run une fois
.env.example       → template des variables d'environnement
```

## 🔑 Données stockées (Supabase)

| Clé          | Contenu                              |
|--------------|--------------------------------------|
| `kg-itin`    | Itinéraire jour par jour (JSON)      |
| `kg-contacts`| Numéros et emails des 8 membres      |
| `kg-notes`   | Notes partagées du groupe            |

Toutes les données sont publiques (accessible sans login) — prévu pour un groupe de confiance.
