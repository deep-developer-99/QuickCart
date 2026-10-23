# React + TypeScript + Vite

## Product sharing previews on Vercel

Product links keep the existing `/products/:id` URL. The Vercel rewrite sends
recognized link preview crawlers for that route to `api/product-meta.js`, which
requests the active product from the existing backend endpoint
`GET /api/products/:id` and returns escaped HTML metadata. Other visitors still
receive the SPA through the existing catchall rewrite and load the existing
React Product Details page. The crawler user-agent check only selects a
response format; it is not an access control.

Configure these Vercel environment variables for the client project:

- `SITE_URL`: the trusted public HTTPS origin assigned to this Vercel project
  or its configured custom domain, without a path. The function uses this value
  for canonical product URLs and never trusts the request Host header.
- `PRODUCT_API_BASE_URL`: the existing backend's public HTTPS API base,
  including `/api` (for example, `https://<your-backend-host>/api`). The backend
  must allow public reads from the Vercel function. Do not add credentials.
- `VITE_API_URL`: the same API base for the browser app, configured as a Vite
  build environment variable as it is today.

The repository's checked-in local environment points to localhost and does not
identify a production frontend or backend domain. Set the real values in Vercel;
do not deploy the sample values in `.env.example`. The function validates product
IDs as 24-character MongoDB ObjectIds, returns 404 for missing or inactive
products, and uses a five-second backend timeout. Successful public previews
are cached for 60 seconds; failures are not cached. Product images are included
only when their URL is absolute HTTPS. The function does not proxy image bytes,
so the product image host must make those URLs publicly readable by preview
crawlers.

Android and iOS association files are not present. No Android package name or
signing certificate fingerprint, and no iOS bundle identifier or Apple Team ID,
could be verified in this repository. Add real values to
`public/.well-known/assetlinks.json` and
`public/.well-known/apple-app-site-association` when the mobile app configuration
is available. Vercel serves these static files ahead of the SPA fallback, and
`vercel.json` assigns both JSON content types. Until then, Android App Links and
iOS Universal Links are not configured or verified.

Deploying is necessary to verify crawler responses with Vercel's actual
environment and domains. Local build checks alone do not verify production link
previews or mobile domain association.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
