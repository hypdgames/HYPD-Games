import { NavLink } from "react-router-dom";
import { Home, Compass, Crown, User } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Compass, label: "Explore" },
  { path: "/pro", icon: Crown, label: "PRO" },
  { path: "/profile", icon: User, label: "Profile" }
];

export default function BottomNav() {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 glass border-t border-border z-50 pb-safe"
      data-testid="bottom-navigation"
    >
      <div className="flex justify-around items-stretch h-11 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 touch-target transition-all duration-200 ${
                isActive 
                  ? "text-lime" 
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
            data-testid={`nav-${label.toLowerCase()}`}
          >
            {({ isActive }) => (
              <>
                <Icon 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`} 
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={`text-[10px] mt-0.5 font-medium ${
                  isActive ? "font-bold" : ""
                }`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
