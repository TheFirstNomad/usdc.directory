# Architecture Rules

- Load the main application through `AppBootstrap` so module-initialization failures render recovery UI instead of leaving an empty root.
- Vite config hardcodes the public backend URL/publishable key as fallbacks and fails the build if the URL is not project ddhytszijvfejnymrwgd, because .env is not present in published builds.
