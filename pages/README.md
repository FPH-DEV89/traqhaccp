# Déploiement Cloudflare Pages (option 0 €)

Le repo vise Vercel par défaut ; `pages/` ajoute la voie **Cloudflare Pages gratuite**
(illimité en requêtes, 500 builds/mois) — décision Florian du 25/11/2026, après
le soft-block Vercel (quota 1 M req/30 j) qui a mis les 9 projets en 402.

## Construire le paquet

```bash
./pages/build-dist.sh      # → dist-pages/ (~700 Ko, 44 fichiers)
node pages/verify-dist.mjs # 33 assets précachés + 27 modules, 0 import cassé
```

`dist-pages/` exclut `docs/` (7 Mo de captures), `graphify-out/`, `specs/`, `.github/` :
rien de tout ça n'est servi par l'application.

## Déployer

```bash
export CLOUDFLARE_API_TOKEN=<token Pages:Edit>
export CLOUDFLARE_ACCOUNT_ID=bb330a42da1c42001681dc8757212d01
npx wrangler pages project create traqhaccp-pro --production-branch=main
npx wrangler pages deploy dist-pages --project-name traqhaccp-pro
```

## Après déploiement — non négociable

1. `curl -I https://traqhaccp-pro.pages.dev/` → **200**
2. `curl -I .../sw.js` → `Cache-Control: no-cache, no-store, must-revalidate`
3. `PLAYWRIGHT_BROWSERS_PATH=/opt/data/.pw-browsers node pages/smoke-dist.mjs`
   (adapter l'URL) → 6 vues, portail, **0 erreur console**
4. Se connecter avec un compte réel : le registre doit afficher le badge vert
   « SAUVEGARDÉ » (sinon Supabase n'est pas joignable depuis le nouveau domaine).

## Piège connu

`_headers` doit garder `sw.js` en `no-store`. Sans ça, les clients déjà installés
restent sur l'ancien service worker — c'est exactement la panne du 01/10/2026,
et le gate `check-sw-bump.mjs` ne protège que le bump de `CACHE_NAME`, pas les
en-têtes de réponse.
