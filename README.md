# Élan

Application d’entraînement installable sur iPhone. React + Vite pour l’interface, GitHub Pages pour l’hébergement, Supabase Auth et Postgres pour les données privées.

## Mise en service

1. Dans le projet Supabase, ouvrir **SQL Editor**, coller le contenu de [`supabase/schema.sql`](supabase/schema.sql), puis **Run**. Ce script crée uniquement les tables Élan et leurs règles d’accès. Il est réexécutable.
2. Dans Supabase Auth, autoriser les inscriptions par e-mail, conserver la confirmation d’adresse et configurer un service SMTP pour les utilisateurs externes. Renseigner la Site URL et la liste des redirections autorisées avec l’adresse exacte de l’application. L’écran de connexion propose **Créer un compte**, avec confirmation du mot de passe et lien envoyé par e-mail. Si les inscriptions sont désactivées, l’interface le signale. Les invitations et la gestion des comptes restent disponibles dans **Authentication → Users**. Ne jamais publier de mot de passe ni de clé administrative dans le dépôt.
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

## Comptes et programmes préinstallés

Le catalogue commun est dans `elan_exercises` : appliquer `supabase/schema.sql`, puis `supabase/catalogue.sql`. Les utilisateurs connectés peuvent le lire, sans pouvoir le modifier. Leurs programmes, charges et historiques restent isolés par compte. Les fiches privées existantes gardent la priorité sur le catalogue partagé.

Pour préparer un programme pour un nouveau compte : inviter la personne depuis Supabase Authentication, puis préparer un import privé avec `node --experimental-strip-types scripts/prepare-profile.mjs sauvegarde.json adresse@example.com profil.sql`. Exécuter ce SQL dans le projet Supabase. Il n’écrase jamais un programme existant. Garder les sauvegardes et SQL produits hors du dépôt public. Le programme se charge à la première connexion.

La connexion propose « Mot de passe oublié ». Configurer la Site URL sur l’adresse de l’application et autoriser la même adresse avec `?recovery=1`. Les liens de récupération et d’invitation ouvrent le formulaire de choix du mot de passe. Les utilisateurs saisissent leurs mots de passe eux-mêmes.

## Assistants IA et administration

Le connecteur distant est `https://aciowkdgysvbecglwepy.supabase.co/functions/v1/elan-mcp` (Streamable HTTP). Il fournit six outils : chercher les exercices, lister/lire les séances, enregistrer un exercice, enregistrer une séance complète, archiver/restaurer une séance. Les durées d’entrée sont au format `MM:SS`. Une révision est requise pour chaque écriture afin de refuser les écrasements concurrents.

Le consentement s’affiche à la racine de l’application lorsqu’un `authorization_id` est présent. L’utilisateur choisit la lecture seule ou la lecture/modification ; les droits métiers sont conservés dans `elan_ai_grants`, distincts des scopes d’identité OAuth. Profil et réglages → Assistants IA permet de révoquer ces droits immédiatement puis d’invalider le grant OAuth. Les jetons OAuth n’accèdent jamais directement aux tables, à l’historique ou aux fonctions d’administration. Une réautorisation exige un jeton émis après le nouvel accord.

Les administrateurs trouvent **Gérer les utilisateurs** dans Profil et réglages : inviter, suspendre/réactiver et ajouter/retirer le rôle administrateur. Un administrateur ne peut pas modifier ses propres droits. Une suspension bloque immédiatement les opérations cloud et révoque les accès IA ; elle ne supprime pas les données hors connexion déjà présentes sur un appareil. Les comptes ne sont pas supprimés. Les actions sont journalisées côté serveur.

### Déploiement du connecteur

1. Exécuter `supabase/schema.sql`, puis `supabase/admin.sql` si nécessaire, et enfin `supabase/ai-access.sql` **avant d’activer OAuth**. Ne pas réexécuter `admin.sql` seul après cette migration : il rétablirait l’ancienne vérification de rôle.
2. Déployer : `supabase functions deploy elan-mcp elan-admin --project-ref aciowkdgysvbecglwepy --use-api --import-map supabase/functions/deno.json`.
3. Activer le serveur OAuth Supabase et l’enregistrement dynamique des clients. Avec le Site URL actuel (qui contient déjà `/elan-entrainement/`), utiliser `authorization_url_path = "/"` pour aboutir à `https://caelors.github.io/elan-entrainement/` avec le paramètre `authorization_id`. Conserver le Site URL et les redirections de récupération existants. Vérifier la redirection avec une demande PKCE réelle.
4. Les clés serveur sont injectées par Supabase dans les Edge Functions, jamais dans Vite. `ELAN_APP_URL` peut personnaliser la destination des invitations ; défaut : l’URL publique ci-dessus. SMTP doit être configuré pour envoyer des invitations aux utilisateurs externes.
5. Dans ChatGPT ou Claude, ajouter un connecteur MCP distant avec l’URL ci-dessus, s’authentifier et choisir les droits. La disponibilité des connecteurs dépend du compte et des règles de l’espace de travail. Aucun mot de passe ni clé administrative à transmettre à l’assistant.

Tests : `npm test`, `npm run build`, `npm ci --prefix server`, `npm run check --prefix server`, `npm test --prefix server`. Les tests SQL exécutent les politiques réelles dans PGlite avec plusieurs rôles et comptes. Les tests MCP exercent le protocole HTTP du SDK officiel. Les tests réels de consentement/confirmation d’e-mail requièrent un compte utilisateur et ne sont pas simulés par ces tests.
