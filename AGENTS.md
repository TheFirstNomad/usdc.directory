# Architecture Rules

- Load the main application through `AppBootstrap` so module-initialization failures render recovery UI instead of leaving an empty root.