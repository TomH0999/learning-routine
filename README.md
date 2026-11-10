# learning-routine — v1.0.0
Mon outil d'apprentissage quotidien (PWA pour iPhone, hébergée sur GitHub Pages).

## Fonctions
- **Note du cours du jour** : éditeur de notes + chrono de 1h qui ne s'écoule que lorsque ce mode est ouvert et l'app au premier plan.
- **Leçons** : toutes les notes, recherche par titre/matière/contenu ou par date, tri (date ↑↓, titre, matière, longueur).
- **Jours sautés** : la veille d'un contrôle/test, d'une SAÉ ou de tout rendu d'importance ≥ Haute, lu (lecture seule) depuis le gestionnaire de devoirs (compte thacot008@gmail.com).
- **Rappels** : notification toutes les heures (8h–22h) sur l'iPhone tant que l'heure n'est pas faite.
- **Données** : stockées sur l'appareil (localStorage persistant) ; export/import JSON par fusion — les mises à jour de l'app ne touchent jamais aux données.

## Installation (une seule fois)
1. **GitHub Pages** : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/`.
2. Sur l'iPhone, ouvrir https://tomh0999.github.io/learning-routine/ dans Safari → Partager → **Sur l'écran d'accueil**. Toujours utiliser l'app depuis cette icône (données propres à l'icône).
3. **Notifications** : installer l'app **ntfy** (App Store), s'abonner à un sujet secret (ex. `routine-` + 12 caractères aléatoires). Dans Réglages iOS → ntfy, mettre le style d'alerte sur **Persistante** pour que la bannière ne disparaisse pas d'elle-même.
4. Dans le dépôt : Settings → Secrets and variables → Actions : `NTFY_TOPIC` (le sujet) et `GDN_PASSWORD` (mot de passe du gestionnaire).
5. Dans l'app → Réglages : saisir le même sujet ntfy, puis se connecter au gestionnaire.

## Limites (iOS)
iOS ne permet à aucune app web d'afficher une notification impossible à effacer. Le comportement retenu : rappel **répété chaque heure** (prioritaire à partir de 20h) jusqu'à ce que l'app publie « DONE » à la fin de l'heure. Les crons GitHub peuvent être retardés de quelques minutes.
