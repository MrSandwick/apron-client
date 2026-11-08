# Client

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.17.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Menu data (API)

The `/menu` page loads its dishes from the Django API in `../server` (see `../server/README.md` for setup).

- **Development**: run the API on `127.0.0.1:8000`. `ng serve` forwards `/api` and `/media` to it (`proxy.conf.json`). If the API is down the page shows the bundled sample menu with a quiet notice.
- **Rendering**: `/menu` is server-rendered on each request, not prerendered, so database edits show up without a rebuild. The server's copy of the menu is embedded in the page, so the browser does not ask the API again after hydration.
- **Production**: put a reverse proxy in front that sends `/api`, `/media` and `/admin` to Django and everything else to the Angular server.
- **The server must reach the API**: either leave `API_INTERNAL_URL` unset (the server calls the site's own public address, through the proxy), or set `API_INTERNAL_URL` to the API's internal address, for example `http://127.0.0.1:8000`.
- **Allowed hosts**: Angular's server rejects requests whose `Host` header is not allowed and falls back to client-side rendering (no server-rendered menu). Set `NG_ALLOWED_HOSTS` to the site's domain or domains, comma separated, in production. `localhost` is accepted by default.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
