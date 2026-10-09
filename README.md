# Élan

Application web d’entraînement en français : séances guidées, compte à rebours, minuteurs, récupération et exercices intercalaires, suivi des séries, historique, export JSON/CSV et fonctionnement hors ligne après installation de la version hébergée.

Ce dépôt contient uniquement le code, des sons génériques et un programme de démonstration. Il ne contient ni programme personnel, ni données de santé, ni historique d’entraînement, ni identifiants d’hébergement ou secrets. Les valeurs du programme de démonstration servent à tester l’interface.

## Développement

Node.js 22.13 ou supérieur et npm récent.

```sh
npm ci
npm run dev -- --port 5173
```

```sh
node --experimental-strip-types --test tests/engine.test.ts
npx tsc --noEmit
npm run build
node scripts/cache-build.mjs
```

## Hébergement privé

L’application utilise un Worker Cloudflare et une base D1, avec authentification privée fournie par Sites. Le fichier `.openai/hosting.json` est un modèle sans identifiant de site : la publication nécessite la configuration de son propre hébergement et l’application des migrations `drizzle/`.

GitHub héberge le code uniquement. GitHub Pages n’est pas activé et ne peut pas exécuter les routes serveur de cette version.

## Données et sauvegardes

Les séances sont sauvegardées dans IndexedDB sur l’appareil. Les routes serveur exigent une identité authentifiée. Le miroir Google Sheets est optionnel ; ses secrets restent côté serveur. Les variables attendues sont listées sans valeur dans `.env.example`.

Ne jamais versionner les historiques exportés, les bases locales, les clés de service ou les documents personnels. Le programme JSON fourni est fictif ; une installation privée peut le remplacer par son propre programme.

## Installation sur téléphone

Après publication privée, ouvrir le site dans Safari sur iPhone, puis Partager → Sur l’écran d’accueil. Charger une première fois en ligne pour préparer le cache. La continuité audio et le maintien de l’écran allumé dépendent du navigateur.
