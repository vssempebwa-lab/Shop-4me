import { ShoppingCart, Phone, Mail, MapPin, Truck, ShieldCheck, Clock } from 'lucide-react';
import { MerchantToggle } from './Header';

interface FooterProps {
  merchantMode: boolean;
  onToggleMerchant: () => void;
}

export default function Footer({ merchantMode, onToggleMerchant }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-gray-100 bg-white">
      {/* Trust strip */}
      <div className="border-b border-gray-100 bg-brand-50/50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3">
          <Trust icon={<Truck className="h-5 w-5" />} title="Doorstep Delivery" text="Across Uganda, fast & reliable" />
          <Trust icon={<ShieldCheck className="h-5 w-5" />} title="Quality Promise" text="Fresh produce or refunded" />
          <Trust icon={<Clock className="h-5 w-5" />} title="Convenient Hours" text="Order anytime, we deliver" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <p className="font-extrabold text-brand-800">Shop For Me Uganda</p>
                <p className="text-[11px] font-semibold text-gold-600">List, Order &amp; Delivered</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              A reliable, affordable, and convenient way to get everything you need
              delivered straight to your doorsteps.
            </p>
          </div>

          {/* Categories */}
          <div>
            <p className="text-sm font-bold text-gray-800">Categories</p>
            <ul className="mt-3 space-y-2 text-xs text-gray-500">
              <li>Food Sauce</li>
              <li>Fruits</li>
              <li>Spices</li>
              <li>Kitchen Ware</li>
              <li>Cooking Fuels</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-bold text-gray-800">Contact</p>
            <ul className="mt-3 space-y-2 text-xs text-gray-500">
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-brand-600" /> +256 700 000 000</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-brand-600" /> hello@shopforme.ug</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-brand-600" /> Kampala, Uganda</li>
            </ul>
          </div>

          {/* Merchant */}
          <div>
            <p className="text-sm font-bold text-gray-800">For Shop Keepers</p>
            <p className="mt-3 text-xs text-gray-500">
              Switch to the merchant view to manage products, prices and orders.
            </p>
            <div className="mt-3">
              <MerchantToggle merchantMode={merchantMode} onToggle={onToggleMerchant} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-100 pt-5 sm:flex-row">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Shop For Me Uganda. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">Pay with MTN / Airtel Mobile Money</p>
        </div>
      </div>
    </footer>
  );
}

function Trust({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{text}</p>
      </div>
    </div>
  );
}
