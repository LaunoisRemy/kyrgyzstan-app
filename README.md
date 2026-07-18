# Kirghizistan 2026 — App de planification du groupe

Stack : **Vite + React + Supabase** · Déployable sur Vercel gratuitement.

---

## 🎒 Contexte

Voyage à 8 au Kirghizistan, du **30 juillet au 14 août 2026** : Clara Ka, Henri Blln, Mael Demmerle, Maëlle Guegaden, Nathan Rougier, Rémy Launois, Thibault Azemar, Thomas Mestrou.

Le trip se découpe en 3 phases :

- **J1** — journée ville à Bichkek
- **J2–J6** — trek à cheval avec nuits en yourte, organisé par l'agence **Tatosh** (contact référent : Henri), incluant un bivouac en altitude vers Song-Köl (~3000–3500m), nuits froides (0°C à -5°C, risque de neige)
- **J7–J15** — phase autonome en 4x4 dans la zone Issyk-Koul/Karakol, deux véhicules (Subaru Outback + Lexus RX) réservés auprès d'une agence locale (contact : Aydana)

Tatosh fournit les yourtes pendant le trek, mais tente/sac de couchage/matelas sont à gérer par le groupe pour la phase 4x4 — d'où le système de partage de matos (ex : "2 personnes par tente").

Coordination annexe : **Tricount** pour les dépenses, **Google Drive** partagé (sous-dossiers "Song Kol" et "Tatosh") pour les documents.

## 🎯 But de l'app

Centraliser toute la coordination du groupe (itinéraire, contacts, matos, notes) à un seul endroit accessible à tous **sans compte à créer** — plutôt que de disperser l'info entre Drive, Tricount et des messages. Pensée pour un groupe de confiance : pas d'authentification, tout est modifiable par tout le monde.

## 📑 Onglets de l'app

| Onglet | Rôle |
|--------|------|
| 📅 Itinéraire | Détail jour par jour du voyage (activités, logement, notes) |
| ✈ Vols | Récap des vols/trajets du groupe |
| 🐎 Agences | Infos et contacts des agences (Tatosh, location 4x4) |
| 🗺 Carte | Carte interactive de l'itinéraire |
| 👥 Groupe | Coordonnées des 8 membres |
| ✅ Checklist | Matos à apporter, coché par personne |
| 💬 Notes | Notes libres partagées par le groupe |

## 🗺 Roadmap en cours

Voir [`ROADMAP.md`](./ROADMAP.md) à la racine du projet pour la checklist fonctionnelle des prochaines features (identité sans authentification, catégories dynamiques, système de "slots" pour l'orga/matos, etc.) — pensé pour donner le contexte à Claude Code sans avoir à tout réexpliquer à chaque session.

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
