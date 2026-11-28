import { DownloadPage, TasksPage } from "@manager/ui";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { buildInfo } from "./buildInfo";
import { ProfilePage } from "./profile";
import { PreviewPage } from "./preview";
import { PwaUpdate } from "./pwa";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <PwaUpdate />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <TasksPage
      buildInfo={buildInfo}
      vapidPublicKey={import.meta.env.VITE_VAPID_PUBLIC_KEY}
    />
  ),
});

const downloadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/download",
  component: () => (
    <DownloadPage deployEnv={import.meta.env.VITE_DEPLOY_ENV} />
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});

const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/preview",
  component: PreviewPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  downloadRoute,
  profileRoute,
  previewRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
