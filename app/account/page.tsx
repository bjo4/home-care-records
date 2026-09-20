import { AppFrame } from "@/components/app-frame";
import { AccountPanel } from "@/components/account-panel";
import { requireCurrentUser } from "@/lib/session";

type Props = {
  searchParams?: Promise<{
    password?: string;
  }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  return (
    <AppFrame
      active="account"
      title="帳號"
      description="管理登入、密碼與本機資料工具。"
    >
      <AccountPanel user={user} status={params?.password} />
    </AppFrame>
  );
}
