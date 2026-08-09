import React from "react";

const Passthrough = ({ children }) => children;

let currentPath = "/";

export const Routes = ({ children }) => {
  const routes = React.Children.toArray(children);

  const matched = routes.find((child) => {
    const path = child.props?.path;

    if (!path) return false;

    if (path === "/") return currentPath === "/";

    return currentPath.startsWith(path);
  });

  return matched ? matched.props.element : null;
};

export const Route = ({ element }) => element;

export const Navigate = () => null;

export const MemoryRouter = Passthrough;

export const BrowserRouter = Passthrough;

export const useLocation = () => ({ pathname: currentPath });

export const useNavigate = () => jest.fn();
