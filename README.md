# Élan

Application d’entraînement installable sur iPhone. React + Vite pour l’interface, GitHub Pages pour l’hébergement, Supabase Auth et Postgres pour les données privées.

## Mise en service

1. Dans le projet Supabase, ouvrir **SQL Editor**, coller le contenu de [`supabase/schema.sql`](supabase/schema.sql), puis **Run**. Ce script crée uniquement les tables Élan et leurs règles d’accès. Il est réexécutable.
2. Dans **Authentication → Users → Add user → Create new user**, créer son compte Élan avec une adresse et un mot de passe ; cocher la confirmation de l’adresse. Il s’agit du compte de l’application, distinct du compte administrateur Supabase. Ne jamais publier ce mot de passe dans le dépôt.
3. Dans le dépôt GitHub, ouvrir **Settings → Pages → Build and deployment → Source → GitHub Actions**. Le workflow `.github/workflows/pages.yml` teste, construit puis publie chaque push sur `main`. Si nécessaire, lancer **Actions → Test and deploy Élan → Run workflow** après l’activation de Pages.
4. Ouvrir l’adresse donnée par le déploiement, se connecter et importer la sauvegarde JSON de l’ancienne application (**Réglages → Sauvegarde complète**). L’import reprend le programme, les réglages et l’historique. Il conserve les séances déjà présentes ; une copie avant import est téléchargée si le compte contenait déjà des données.
5. Sur iPhone, ouvrir l’adresse dans Safari puis **Partager → Sur l’écran d’accueil**. Se connecter dans l’application installée si iOS ouvre un stockage distinct, puis attendre la synchronisation initiale.

La clé `sb_publishable_…` et l’URL dans `lib/supabase.ts` sont publiques. Les accès sont protégés par la session et les règles RLS (`auth.uid() = user_id`). Aucune clé secrète ou `service_role` n’est utilisée. Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` permettent de choisir un autre projet au moment du build.

## Programme et sauvegardes

Modifier une séance dans **Bibliothèque → Modifier la séance** enregistre une nouvelle version du programme dans Supabase. Les séances passées restent intactes. Le programme personnel n’est pas livré dans le code. Le JSON public fourni est une fixture de démonstration utilisée par les tests ; les nouveaux comptes commencent vides.

Les données et la séance en cours sont sauvegardées dans IndexedDB, dans un espace séparé par compte. Hors connexion, les séances restent sur l’appareil et attendent le retour du réseau. Le programme et l’historique sont synchronisés au chargement, après les modifications, au retour dans l’application et toutes les 30 secondes tant qu’elle est visible. La séance en cours et les préférences audio restent propres à l’appareil.

Les modifications concurrentes du programme sont détectées : les réglages permettent de choisir la version locale ou distante après téléchargement d’une sauvegarde. Une fenêtre active par compte et par navigateur évite que deux onglets écrasent une séance locale. La déconnexion est bloquée pendant une séance ou tant que des modifications attendent la synchronisation.

Le cache de l’application est séparé des données. Une mise à jour se télécharge en arrière-plan, puis s’applique à l’accueil après sauvegarde, hors séance et hors modification. Toutes les fenêtres ouvertes doivent être prêtes. Les déploiements prennent le temps de la construction GitHub ; ce n’est pas un remplacement instantané du code en cours d’exécution.

Une sauvegarde en ligne permet de retrouver programme et historique si le stockage du téléphone est effacé. La séance en cours non terminée reste locale : exporter régulièrement une sauvegarde complète reste utile.

## Développement et vérification

Node.js 22.13 ou supérieur.

```sh
npm ci
npm test
npm run build
npm run dev
```

Le chemin de publication est `/elan-entrainement/`, configuré dans `vite.config.ts` et `scripts/cache-build.mjs`. `npm run preview` sert le build de production pour vérifier la PWA.

Les tests exécutent le moteur de séance, les imports, le stockage local par compte, la fusion pendant les synchronisations et le SQL dans un Postgres local éphémère (PGlite) avec deux utilisateurs et un rôle anonyme. Un essai connecté sur le véritable projet Supabase reste nécessaire après sa configuration.

Ne jamais ajouter les exports personnels, bases locales, clés de service ou mots de passe au dépôt.
