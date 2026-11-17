import { Home, UtensilsCrossed, ShoppingBag, User } from 'lucide-react';

export type AppView = 'inicio' | 'menu' | 'planes' | 'mi-pedido' | 'mi-cuenta' | 'admin';

interface MobileBottomBarProps {
  activeView: AppView;
  draftCount?: number;
  onSelectView: (view: AppView) => void;
}

export function MobileBottomBar({
  activeView,
  draftCount = 0,
  onSelectView,
}: MobileBottomBarProps) {
  const items: { id: AppView; label: string; icon: typeof Home }[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'menu', label: 'Menú', icon: UtensilsCrossed },
    {
      id: 'mi-pedido',
      label: draftCount > 0 ? `Pedido (${draftCount})` : 'Mi pedido',
      icon: ShoppingBag,
    },
    { id: 'mi-cuenta', label: 'Mi cuenta', icon: User },
  ];

  return (
    <nav
      aria-label="Navegación inferior móvil"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#234D35] text-[#EDF3E5] border-t border-[#C6DE8B]/25 shadow-lg"
    >
      <div className="grid grid-cols-4 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer px-1 ${
                isActive
                  ? 'text-[#C6DE8B] bg-[#193B29]/50'
                  : 'text-[#DCE8D2]/90 hover:text-[#EDF3E5]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
