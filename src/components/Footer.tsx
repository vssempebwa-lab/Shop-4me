import { Phone, Mail, MapPin, Truck, ShieldCheck, Clock } from 'lucide-react';
import type { SiteSettings } from '../lib/siteSettings';
import shopForMeLogo from '../../Admin-Pics/shop for me logo free.png';

interface FooterProps {
  siteSettings: SiteSettings;
}

export default function Footer({
  siteSettings,
}: FooterProps) {
  const trustIcons = {
    truck: <Truck className="h-5 w-5" />,
    shield: <ShieldCheck className="h-5 w-5" />,
    clock: <Clock className="h-5 w-5" />,
  };

  return (
    <footer className="mt-12 border-t border-gray-100 bg-white">
      {/* Trust strip */}
      <div className="border-b border-gray-100 bg-brand-50/50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3">
          {siteSettings.trustBadges.map((badge) => (
            <Trust
              key={badge.key}
              icon={trustIcons[badge.icon]}
              imageUrl={badge.imageUrl}
              title={badge.title}
              text={badge.description}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="inline-flex items-center rounded-2xl bg-brand-950 px-3 py-2 shadow-sm">
              <img
                src={shopForMeLogo}
                alt="Shop For Me Uganda"
                className="h-14 w-40 object-contain object-left"
              />
            </div>
            <p className="mt-3 text-xs text-gray-500" data-site-text="footerTagline">
              {siteSettings.footerTagline}
            </p>
          </div>

          {/* Categories */}
          <div>
            <p className="text-sm font-bold text-gray-800">{siteSettings.footerCategoriesTitle}</p>
            <ul className="mt-3 space-y-2 text-xs text-gray-500">
              {siteSettings.footerCategories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-bold text-gray-800">{siteSettings.footerContactTitle}</p>
            <ul className="mt-3 space-y-2 text-xs text-gray-500">
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-brand-600" /> {siteSettings.footerPhone}</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-brand-600" /> {siteSettings.footerEmail}</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-brand-600" /> {siteSettings.footerAddress}</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-100 pt-5 sm:flex-row">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Shop For Me Uganda. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">{siteSettings.footerPaymentText}</p>
        </div>
      </div>
    </footer>
  );
}

function Trust({
  icon,
  imageUrl,
  title,
  text,
}: {
  icon: React.ReactNode;
  imageUrl?: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full rounded-xl object-cover" /> : icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{text}</p>
      </div>
    </div>
  );
}
