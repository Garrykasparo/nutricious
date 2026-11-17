import { useState } from 'react';
import { Menu, X, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { AppView } from './MobileBottomBar';

interface NavbarProps {
  activeView: AppView;
  draftCount?: number;
  onNavigateView: (view: AppView) => void;
  onNavigateSection: (sectionId: string) => void;
}

const SECTION_LINKS = [
  { id: 'nosotros', label: 'Nosotros' },
  { id: 'beneficios', label: 'Beneficios' },
  { id: 'como-funciona', label: 'Cómo funciona' },
];

export function Navbar({
  activeView,
  draftCount = 0,
  onNavigateView,
  onNavigateSection,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSection = (sectionId: string) => {
    setMobileOpen(false);
    onNavigateSection(sectionId);
  };

  const handleView = (view: AppView) => {
    setMobileOpen(false);
    onNavigateView(view);
  };

  return (
    <header className="relative md:sticky md:top-0 z-40 w-full bg-[#DCE8D2]/95 backdrop-blur-sm border-b border-[#234D35]/12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleView('inicio')}
          className="font-display text-xl font-bold tracking-tight text-[#193B29] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#234D35] rounded text-left"
        >
          Nutricious H&amp;D
        </button>

        {/* Zone 2: Navigation Links (Inicio, Nosotros, Beneficios, Cómo funciona, Planes, Menú, Mi cuenta) */}
        <nav
          aria-label="Navegación principal"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-[#193B29]"
        >
          <button
            type="button"
            onClick={() => handleView('inicio')}
            aria-current={activeView === 'inicio' ? 'page' : undefined}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer ${
              activeView === 'inicio'
                ? 'border-[#234D35] text-[#234D35] font-semibold'
                : 'border-transparent hover:border-[#234D35] hover:text-[#234D35]'
            }`}
          >
            Inicio
          </button>

          {SECTION_LINKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSection(item.id)}
              className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#234D35] hover:text-[#234D35] transition-colors duration-150 cursor-pointer"
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleView('planes')}
            aria-current={activeView === 'planes' ? 'page' : undefined}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer ${
              activeView === 'planes'
                ? 'border-[#234D35] text-[#234D35] font-semibold'
                : 'border-transparent hover:border-[#234D35] hover:text-[#234D35]'
            }`}
          >
            Planes
          </button>

          <button
            type="button"
            onClick={() => handleView('menu')}
            aria-current={activeView === 'menu' ? 'page' : undefined}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer ${
              activeView === 'menu'
                ? 'border-[#234D35] text-[#234D35] font-semibold'
                : 'border-transparent hover:border-[#234D35] hover:text-[#234D35]'
            }`}
          >
            Menú
          </button>

          <button
            type="button"
            onClick={() => handleView('mi-cuenta')}
            aria-current={activeView === 'mi-cuenta' ? 'page' : undefined}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer ${
              activeView === 'mi-cuenta'
                ? 'border-[#234D35] text-[#234D35] font-semibold'
                : 'border-transparent hover:border-[#234D35] hover:text-[#234D35]'
            }`}
          >
            Mi cuenta
          </button>
        </nav>

        {/* Zone 3: Single Primary Action + Cart Shortcut + Tablet/Mobile Drawer Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleView('mi-pedido')}
            aria-current={activeView === 'mi-pedido' ? 'page' : undefined}
            className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-xl border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'mi-pedido'
                ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Mi pedido</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-[#234D35] text-[#EDF3E5] tabular-nums">
              {draftCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleView('menu')}
            className="inline-flex items-center justify-center px-4 sm:px-5 py-2.5 text-sm font-semibold text-[#EDF3E5] bg-[#28583C] hover:bg-[#1e432d] rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193B29]"
          >
            Hacer mi pedido
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl text-[#193B29] hover:bg-[#EDF3E5] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#234D35]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Tablet & Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Navegación desplegable"
          className="lg:hidden bg-[#EDF3E5] border-b border-[#234D35]/15 px-4 py-4 flex flex-col gap-1.5"
        >
          <button
            type="button"
            onClick={() => handleView('inicio')}
            className="text-left px-3 py-2.5 text-base font-medium text-[#193B29] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
          >
            Inicio
          </button>

          {SECTION_LINKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSection(item.id)}
              className="text-left px-3 py-2.5 text-base font-medium text-[#193B29] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleView('planes')}
            className="text-left px-3 py-2.5 text-base font-medium text-[#193B29] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
          >
            Planes semanales
          </button>

          <button
            type="button"
            onClick={() => handleView('menu')}
            className="text-left px-3 py-2.5 text-base font-medium text-[#193B29] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
          >
            Menú
          </button>

          <button
            type="button"
            onClick={() => handleView('mi-cuenta')}
            className="text-left px-3 py-2.5 text-base font-medium text-[#193B29] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
          >
            Mi cuenta
          </button>

          <div className="mt-2 pt-3 border-t border-[#234D35]/15">
            <button
              type="button"
              onClick={() => handleView('admin')}
              className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm font-semibold text-[#234D35] rounded-xl hover:bg-[#DCE8D2] transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              Acceso administrativo
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
