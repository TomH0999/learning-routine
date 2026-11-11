# learning-routine — v1.10.0
Mon outil d'apprentissage quotidien (PWA pour iPhone, hébergée sur GitHub Pages).

## Fonctions
- **Note du cours du jour** : éditeur de notes + chrono de 1h qui ne s'écoule que lorsque ce mode est ouvert et l'app au premier plan.
- **Notes enrichies** : gras, italique, souligné, barré, titres, listes, citation, code, séparateur, couleurs et surlignage (barre d’outils tactile sur iPhone, raccourcis Ctrl+B/I/U sur PC).
- **Affichage** : Réglages → « Performances » (léger) ou « Qualité visuelle » (PC uniquement : néon, HUD, radar, constellation, anneau de chrono, curseur réticule, effets au survol). Mise en page adaptée aux fenêtres moitié/tiers d’écran.
- **Catégories** : BUT1, BUT2, BUT3, Maths prépa, Bourse + catégories personnalisées, sur les leçons et les sujets, filtrables dans Leçons et Sujets.
- **Sujets** : liste de sujets à étudier (synchronisée), case « maîtrisé », sessions, temps et lignes par sujet, bouton « Étudier » et « Réviser les notes ».
- **Leçons** : toutes les notes, recherche par titre/matière/contenu ou par date, tri (date ↑↓, titre, matière, longueur).
- **Jours sautés** : la veille d'un contrôle/test, d'une SAÉ ou de tout rendu d'importance ≥ Haute, lu (lecture seule) depuis le gestionnaire de devoirs (compte thacot008@gmail.com).
- **Rappels** : notification toutes les heures (8h–22h) sur l'iPhone tant que l'heure n'est pas faite.
- **Synchronisation iPhone ↔ PC portable ↔ PC fixe** : leçons et chrono synchronisés via Supabase (table dédiée `lr_items`, séparée du gestionnaire), dès que l'app est connectée au compte. Le temps fait sur chaque appareil s'additionne. Fonctionne hors ligne, synchronise au retour du réseau (et toutes les 30 s).
- **Données** : copie locale sur chaque appareil + cloud ; export/import JSON par fusion. Les données de la v1.0.0 sont reprises et envoyées au cloud à la première connexion.
- **Application PC (Windows)** : installeur `Routine-Setup-x.y.z.exe` ; l'app démarre avec Windows dans la zone de notification et affiche une notification Windows qui reste à l'écran chaque heure (8h–22h) tant que l'heure n'est pas faite.

## Installation (une seule fois)
1. **GitHub Pages** : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/`.
2. Sur l'iPhone, ouvrir https://tomh0999.github.io/learning-routine/ dans Safari → Partager → **Sur l'écran d'accueil**. Toujours utiliser l'app depuis cette icône (données propres à l'icône).
3. **Notifications** : installer l'app **ntfy** (App Store), s'abonner à un sujet secret (ex. `routine-` + 12 caractères aléatoires). Dans Réglages iOS → ntfy, mettre le style d'alerte sur **Persistante** pour que la bannière ne disparaisse pas d'elle-même.
4. Dans le dépôt : Settings → Secrets and variables → Actions : `NTFY_TOPIC` (le sujet) et `GDN_PASSWORD` (mot de passe du gestionnaire).
5. Dans l'app → Réglages : saisir le même sujet ntfy, puis se connecter au gestionnaire.

## Installer sur PC
Onglet **Releases** du dépôt → télécharger `Routine-Setup-1.1.0.exe` → lancer (Windows SmartScreen : « Informations complémentaires » → « Exécuter quand même », l'app n'est pas signée). Puis Réglages → se connecter. L'installeur et la Release sont créés automatiquement par GitHub Actions à chaque mise à jour de `main` (version lue dans `desktop/package.json`) (ou manuellement : Actions → « Installeur PC » → Run workflow, fichier dans les artefacts).

## Limites (iOS)
iOS ne permet à aucune app web d'afficher une notification impossible à effacer. Le comportement retenu : rappel **répété chaque heure** (prioritaire à partir de 20h) jusqu'à ce que l'app publie « DONE » à la fin de l'heure. Les crons GitHub peuvent être retardés de quelques minutes.

## Mises à jour
- **PC** : l'app vérifie les Releases GitHub au démarrage puis toutes les 4 h, télécharge la nouvelle version en arrière-plan et propose « Redémarrer » (sinon installée à la fermeture). *La v1.1.0 n'avait pas de mise à jour automatique : installer une fois la v1.2.0 à la main.*
- **iPhone** : l'app se met à jour toute seule (vérification toutes les 30 min, bandeau « Recharger » si tu es en train d'écrire).
- Publier une version : changer `version` dans `desktop/package.json` puis fusionner dans `main`.
