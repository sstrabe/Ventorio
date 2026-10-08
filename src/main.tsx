import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import { Shell } from "./components/shell";
import "./index.css";
import { EventPage } from "./pages/EventPage";
import { Events } from "./pages/Events";
import { Inventory } from "./pages/Inventory";
import { ItemPage, TagPage } from "./pages/ItemPage";
import { Labels } from "./pages/Labels";
import { NotFound } from "./pages/NotFound";
import { Overview } from "./pages/Overview";
import { Templates } from "./pages/Templates";

const router = createBrowserRouter([
    {
        element: (
            <Shell>
                <Outlet />
            </Shell>
        ),
        children: [
            { path: "/", element: <Overview /> },
            { path: "/events", element: <Events /> },
            { path: "/events/:id", element: <EventPage /> },
            { path: "/inventory", element: <Inventory /> },
            { path: "/items/:code", element: <ItemPage /> },
            { path: "/t/:code", element: <TagPage /> },
            { path: "/templates", element: <Templates /> },
            { path: "/labels", element: <Labels /> },
            { path: "*", element: <NotFound /> },
        ],
    },
]);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
