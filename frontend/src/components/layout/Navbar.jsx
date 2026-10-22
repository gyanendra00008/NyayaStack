import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-gray-900 tracking-tight">
          Nyaya<span className="text-blue-600">Stack</span>
        </Link>
        <nav className="flex items-center space-x-6">
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
