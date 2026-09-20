import { buttonVariants } from "@/components/ui/button";
import { ClipboardPlus, HeartHandshake, House, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NavKey = "today" | "add" | "care" | "account";

const navItems: { key: NavKey; label: string; href: string; icon: LucideIcon }[] = [
  { key: "today", label: "今日", href: "/", icon: House },
  { key: "add", label: "記錄", href: "/add", icon: ClipboardPlus },
  { key: "care", label: "照護", href: "/care", icon: HeartHandshake },
  { key: "account", label: "帳號", href: "/account", icon: UserRound },
];

export function AppFrame({
  active,
  title,
  eyebrow = "居家照顧紀錄",
  description,
  children,
  actions,
}: {
  active: NavKey;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fed7aa,transparent_22rem),radial-gradient(circle_at_top_right,#bbf7d0,transparent_20rem),linear-gradient(180deg,#fff7ed_0%,#f8fafc_55%,#ecfeff_100%)]">
      <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 pb-24 pt-4 sm:px-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
          <p className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-base leading-7 text-stone-600">{description}</p>
          ) : null}
          {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
        </header>
        {children}
        <footer className="pb-2 text-center text-xs text-muted-foreground">
          異常門檻僅作提醒；若有疑慮請依醫囑或照護團隊建議處理。
        </footer>
      </div>
      <BottomNav active={active} />
    </main>
  );
}

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/90 px-3 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.key === active ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold ${
              item.key === active
                ? "bg-emerald-700 text-white"
                : "text-stone-700 hover:bg-emerald-50 hover:text-emerald-800"
            }`}
          >
            <Icon aria-hidden="true" className="size-5" strokeWidth={2.4} />
            {item.label}
          </a>
          );
        })}
      </div>
    </nav>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className={buttonVariants({ size: "lg", className: "rounded-2xl" })} href={href}>
      {children}
    </a>
  );
}
