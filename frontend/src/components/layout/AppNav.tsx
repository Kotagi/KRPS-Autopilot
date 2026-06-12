import { NavLink } from "react-router-dom";

import { APP_ROUTES } from "../../navigation/routes";

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Mission screens">
      <div className="app-nav-brand">Screens</div>
      <ul className="app-nav-list">
        {APP_ROUTES.map((route) => (
          <li key={route.id}>
            <NavLink
              to={route.path}
              className={({ isActive }) =>
                `app-nav-link${isActive ? " active" : ""}`
              }
            >
              <span className="app-nav-link-label">{route.label}</span>
              <span className="app-nav-link-tagline">{route.tagline}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
