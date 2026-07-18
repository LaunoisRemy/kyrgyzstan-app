# Roadmap — Checklist & Orga

Découpage des tâches pour reprendre avec Claude Code. Pas de code ici, juste la spec fonctionnelle et l'ordre logique de travail.

---

## Décisions prises

- **Réordonnancement des items** : flèches ↑↓ + sélecteur de catégorie (pas de drag&drop).
- **Items partagés (matos) + Orga (transport/logement)** : un seul système générique de **"slots"** réutilisable pour les deux usages.

---

## Phase 1 — Fondations (à faire en premier, tout le reste en dépend) ✅ Fait

### 1.1 Identité sans authentification
- Écran "Je suis : ___" au premier chargement de l'app (liste des 8 membres)
- Choix stocké en `localStorage` du navigateur (par appareil, pas de vraie session)
- Un bouton "changer de personne" quelque part (header ?) pour re-choisir si besoin
- Cette identité remplace le `checklistUser` actuel et devient globale à toute l'app (pas juste l'onglet Matos)
- **⚠️ Point d'architecture à garder en tête** : concevoir ça pour qu'une vraie authentification (login/mot de passe ou magic link) puisse être branchée plus tard sans tout refaire — typiquement, faire en sorte que "l'identité courante" soit récupérée par une fonction unique (ex: `getCurrentUser()`) que le reste de l'app utilise, plutôt que d'accéder au `localStorage` un peu partout dans le code. Le jour où on veut une vraie auth, on ne change que cette fonction.

### 1.2 Catégories dynamiques (Matos)
- Sortir `CHECKLIST_CATS` du code en donnée stockée côté Supabase (comme `checklist.items`)
- UI pour créer une nouvelle catégorie (nom + icône ou emoji)
- Pas besoin de gérer une migration propre des catégories existantes — l'app n'est pas encore utilisée en vrai, donc on peut repartir d'un état vide/par défaut sans se soucier de "casser" des données existantes
- Prévoir quand même un bouton "réinitialiser" (reset des catégories/items à un état par défaut) — utile pendant la phase de test, et potentiellement gardé après pour repartir de zéro si besoin

### 1.3 Contexte projet dans le README
- Le `README.md` actuel est 100% setup technique (Supabase, env, Vercel) — aucun contexte sur le projet lui-même
- Ajouter en haut du README, avant la partie setup :
  - **Contexte** : voyage groupe de 8 au Kirghizistan, dates, les 3 phases (Bichkek / trek cheval-yourtes avec Tatosh / 4x4 autonome Issyk-Koul-Karakol)
  - **But de l'app** : coordination collective sans authentification, pensée pour un groupe de confiance
  - **Ce que fait chaque onglet** (Itinéraire, Overview, Agences, Carte, Contacts, Matos, Notes) en une ligne chacun
  - **Roadmap en cours** : renvoi vers `roadmap-checklist-orga.md` (à la racine du projet) pour que Claude Code ait le contexte des features à venir sans avoir à tout réexpliquer à chaque session

---

## Phase 2 — Checklist : réordonnancement ✅ Fait

### 2.1 Réordonner à l'intérieur d'une catégorie
- Ajouter un champ d'ordre sur chaque item
- Flèches ↑ et ↓ sur chaque ligne pour monter/descendre l'item dans sa catégorie

### 2.2 Déplacer un item vers une autre catégorie
- Sélecteur de catégorie directement sur la ligne de l'item (au lieu de devoir le supprimer/recréer)

---

## Petites finitions (entre Phase 2 et Phase 3) ✅ Fait

- **Carte "moi" cohérente entre onglets** : l'onglet Groupe (Contacts) mettait déjà en évidence sa propre carte en vert dans l'onglet Vols, mais pas dans Groupe — même traitement visuel appliqué aux deux.
- **Sauvegardes multiples et nommées de la checklist** (anticipé depuis Phase 4, voir ci-dessous) : implémenté en avance de phase.

---

## Phase 3 — Système générique de "slots" (le gros morceau)

### Phase 3a — Couche de données + onglet Orga autonome ✅ Fait
`src/slots.js` (logique pure : createSlot/getSlotStatus/canJoin/joinSlot/leaveSlot), store `kg-slots`, nouvel onglet "🧩 Orga" avec création de slot libre, inscription/désinscription, suppression (confirm-gated via la modale maison), indicateur couvert/partiel/complet coloré. US 3.2 couverte.

### Phase 3b — Rattachement checklist ✅ Fait (revu)
Un item de checklist peut être marqué **"partageable"** (case à la création, ou activable après coup sur un item existant). Contrairement à la première version, **un item partageable peut porter plusieurs slots indépendants** — un par personne qui coche la case en apportant le sien (ex: Rémy ET Maëlle ont chacun leur tente sous le même item "Tente", chacun avec sa propre capacité et ses propres inscrits). Cocher la case pour soi crée/rejoint automatiquement son propre slot ; décocher le retire (confirmation si quelqu'un d'autre y est inscrit). N'importe qui peut s'inscrire sur le slot de quelqu'un d'autre sans cocher l'item lui-même. Un panneau "🎒 Objets partagés" en haut de la Checklist liste tous les items partageables et leurs slots en un coup d'œil. Suppression d'un item cascade sur tous ses slots. Testé en live avec un item de test (double slot, jointure croisée, suppression) — donnée réelle (Tente de Rémy+Henri) non affectée. US 3.1 couverte — Phase 3 complète.

### Petite finition — renommer un item / un slot ✅ Fait
Cliquer sur le texte d'un item de checklist, ou sur le titre d'un slot Orga autonome, bascule en édition inline (input, Entrée pour valider, Échap pour annuler). Renommer un item met aussi à jour le titre de ses slots rattachés, pour rester cohérent avec l'affichage dans Orga. Un slot rattaché à un item ne se renomme que depuis la Checklist (source de vérité unique), pas depuis Orga.

### Le principe de base (l'entité "slot")

Un **slot** est une entité indépendante, autonome, qui n'a pas besoin d'un item de checklist pour exister :
- un intitulé libre (ex: "Logement Rémy — mardi soir avant Genève", "Voiture Rémy → Genève", "Tente 4 places")
- une capacité (nombre de personnes que ça couvre)
- une liste de personnes inscrites dessus
- un indicateur visuel : couvert / pas couvert / complet
- règle : une fois la capacité atteinte, plus personne d'autre ne peut s'inscrire (sauf à se retirer d'abord pour libérer une place)

Un slot peut exister **tout seul** (créé directement, sans lien avec quoi que ce soit) — c'est le cas générique.

### US 3.1 — Slot attaché à un item de checklist (matos)

- Sur un item de la checklist (ex: "Tente"), on peut activer une option "partageable" et lui définir une capacité (ex: 2 inscriptions)
- Les gens s'inscrivent directement sur l'item (ex: Rémy + Henri sur "Tente")
- **Un item de checklist n'apparaît PAS automatiquement dans la page Orga.** Le lien est à sens unique : un item peut avoir un slot rattaché, mais ça reste visible/gérable seulement depuis la checklist, pas dupliqué ailleurs.

### US 3.2 — Slot indépendant, créé depuis la page "Orga"

- Nouvel onglet "Orga" dans l'app
- N'importe qui peut créer un slot directement ici, sans lien avec un item (ex: "Logement Rémy — 3 places, mardi soir")
- Les autres s'inscrivent dessus tant qu'il reste de la place
- Usages prévus : hébergement avant/après le trek, covoiturage vers Genève, retour, etc. — l'intitulé doit rester libre (pas de champ "Genève"/"avion" en dur), pour couvrir n'importe quel besoin de coordination par capacité

### Décision — lien entre slot d'item et page Orga
Par défaut, **non cloisonné mais prévu comme extension future** : un slot rattaché à un item (ex: Tente) n'apparaît pas dans Orga pour l'instant. Mais prévoir dès la conception un champ/option du type **"Afficher dans Orga"** (booléen, désactivé par défaut) sur un slot d'item — pour pouvoir l'activer plus tard sans refonte si le besoin se présente en pratique (ex: si on veut centraliser tout ce qui a une capacité limitée sur une seule vue).

### ⚠️ Portée du système de slots
Ce système dépasse le cadre d'une simple checklist (c'est un outil de coordination par capacité). Ça correspond bien à l'ambition évoquée en "Plus tard" ci-dessous (sortir la checklist en app dédiée) — le système de slots pourrait devenir une brique centrale de cette future app, pas juste une feature de l'app actuelle. À garder en tête pour ne pas coder ça de façon trop jetable/couplée à l'app Kirghizistan.

---

## Phase 4 — Améliorations secondaires (à faire si le temps le permet)

- Filtre "afficher seulement les non-cochés" sur la checklist
- Indicateur bien visible des items/slots non attribués (pour repérer vite ce qu'il manque)
- Vue "par personne" : récap de tout ce qu'une personne apporte/est inscrite dessus, utile la veille du départ
- Export/impression de la checklist perso
- ~~**Sauvegardes multiples et nommées de la checklist**~~ ✅ Fait (voir "Petites finitions" ci-dessus) : liste de sauvegardes sous `kg-checklist-backups`, chacune avec nom libre + date, restaurable/supprimable individuellement, limitée aux 10 plus récentes.

---

## Plus tard (hors scope immédiat)

- Sortir le système de checklist de cette app pour en faire un outil dédié avec des listes custom + préétablies (autre projet, à revoir plus tard)
- Le système de slots (Phase 3) est un bon candidat pour devenir une brique de cette future app dédiée, en plus de la checklist elle-même — à garder en tête au moment de le concevoir
- Sauvegardes restreintes à certaines personnes (ex: seul Rémy peut créer/restaurer une sauvegarde) — suppose une notion de permissions par utilisateur, à ne considérer que si une vraie authentification (voir 1.1) est mise en place