import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { DocumentMetaService } from './core/services/document-meta.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
      withRouterConfig({
        paramsInheritanceStrategy: 'always',
      }),
    ),
    provideAppInitializer(() => {
      inject(DocumentMetaService).start();
    }),
  ],
};
