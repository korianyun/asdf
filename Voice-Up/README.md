# React + Vite

## Profile photo moderation

Profile photos are checked with Google Cloud Vision SafeSearch before being saved. The photo is sent to Google Cloud Vision only after the user consents. Automated moderation is an estimate, not a guarantee.

1. Enable the Cloud Vision API and billing in a Google Cloud project.
2. For local development, install and configure the Google Cloud CLI, then run `gcloud auth application-default login` and `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
3. Run `npm run dev` to start the Vite app and local moderation endpoint together. The local server uses Application Default Credentials and never sends credentials to the browser.
4. Run `npm run build` followed by `npm start` to serve the production build and moderation endpoint from the same Node server. In production, attach a least-privilege Google service account using the hosting provider's workload identity or secret manager. Set `PORT` for the listening port and `HOST` when required by the hosting environment.

The local moderation endpoint listens on `127.0.0.1:3001` during development and is proxied by Vite. The production server defaults to port `3000` and host `0.0.0.0`.

SafeSearch rejects photos flagged as `POSSIBLE` or higher for adult, racy, or violent content. Do not use this endpoint on an untrusted public deployment without adding deployment-specific authentication, abuse controls, and Google Cloud quotas.

## Development template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
