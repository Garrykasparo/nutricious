import { Clock, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { MENU_IMAGES } from '../data/menuData';
import { BUSINESS_INFO } from '../utils/pricing';
import type { AppView } from './MobileBottomBar';

interface FooterSectionProps {
  onNavigateView: (view: AppView) => void;
  onNavigateSection: (sectionId: string) => void;
}

export function FooterSection({
  onNavigateView,
  onNavigateSection,
}: FooterSectionProps) {
  return (
    <footer
      id="contacto"
      className="bg-[#234D35] text-[#EDF3E5] border-t border-[#C6DE8B]/20 pb-20 md:pb-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={MENU_IMAGES.logo}
                alt="Logo Nutricious H&D"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border border-[#C6DE8B]/50 shrink-0"
              />
              <div>
                <p className="font-display text-xl font-bold text-[#EDF3E5]">
                  {BUSINESS_INFO.brand}
                </p>
                <p className="text-sm text-[#C6DE8B]">{BUSINESS_INFO.slogan}</p>
              </div>
            </div>
            <p className="text-sm text-[#DCE8D2]/85 leading-relaxed max-w-md">
              Cocina de desayunos, ensaladas, baguettes, jugos funcionales y café orgánico de Chiapas en Mérida, Yucatán.
            </p>
          </div>

          {/* Confirmed Contact, Schedule & Location */}
          <div className="md:col-span-4 space-y-3 text-sm">
            <h3 className="font-display text-base font-bold text-[#C6DE8B]">
              Contacto, horario y ubicación
            </h3>
            <p className="flex items-start gap-2.5 text-[#DCE8D2]/90">
              <Clock className="w-4 h-4 mt-0.5 text-[#C6DE8B] shrink-0" aria-hidden="true" />
              <span>
                {BUSINESS_INFO.scheduleDays} · {BUSINESS_INFO.scheduleHours} ({BUSINESS_INFO.timezone})
              </span>
            </p>
            <p className="flex items-start gap-2.5 text-[#DCE8D2]/90">
              <MapPin className="w-4 h-4 mt-0.5 text-[#C6DE8B] shrink-0" aria-hidden="true" />
              <span>
                {BUSINESS_INFO.city} (dirección exacta de sucursal por confirmar · entregas hasta 13 km con {BUSINESS_INFO.deliveryPartner})
              </span>
            </p>
            <p className="flex items-start gap-2.5 text-[#DCE8D2]/90">
              <Phone className="w-4 h-4 mt-0.5 text-[#C6DE8B] shrink-0" aria-hidden="true" />
              <a
                href={BUSINESS_INFO.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#C6DE8B] underline underline-offset-4 transition-colors"
              >
                WhatsApp: {BUSINESS_INFO.whatsappDisplay}
              </a>
            </p>
          </div>

          {/* Customer Navigation + Separated Admin Access */}
          <div className="md:col-span-4 grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <h3 className="font-display text-base font-bold text-[#C6DE8B]">
                Navegación
              </h3>
              <ul className="space-y-2 text-[#DCE8D2]/90">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateView('inicio')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Inicio
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateSection('nosotros')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Nosotros
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateSection('beneficios')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Beneficios
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateSection('como-funciona')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Cómo funciona
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateSection('planes')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Planes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateView('menu')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Menú
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-base font-bold text-[#C6DE8B]">
                Cuenta y operación
              </h3>
              <ul className="space-y-2 text-[#DCE8D2]/90">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateView('mi-pedido')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Mi pedido
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateView('mi-cuenta')}
                    className="hover:text-[#C6DE8B] transition-colors cursor-pointer text-left"
                  >
                    Mi cuenta
                  </button>
                </li>
              </ul>

              {/* Separated Administration Access */}
              <div className="pt-4 mt-4 border-t border-[#EDF3E5]/15">
                <p className="text-xs uppercase tracking-wider text-[#C6DE8B]/80 mb-2">
                  Acceso interno
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateView('admin')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EDF3E5] bg-[#193B29]/60 hover:bg-[#193B29] px-3 py-2 rounded-xl border border-[#C6DE8B]/25 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C6DE8B] shrink-0" aria-hidden="true" />
                  Administración
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#EDF3E5]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#DCE8D2]/75">
          <p>
            © {new Date().getFullYear()} {BUSINESS_INFO.brand} · {BUSINESS_INFO.city}. Moneda MXN.
          </p>
          <p>
            Fase 1: Página comercial y navegación · Módulos de pedidos, cuenta y operación en próximas fases.
          </p>
        </div>
      </div>
    </footer>
  );
}
