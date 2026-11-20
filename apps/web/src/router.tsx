import { DownloadPage, TasksPage } from "@manager/ui";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TasksPage,
});

const downloadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/download",
  component: () => (
    <DownloadPage deployEnv={import.meta.env.VITE_DEPLOY_ENV} />
  ),
});

const routeTree = rootRoute.addChildren([indexRoute, downloadRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
