import { AppFrame } from "@/components/app-frame";
import { AccountPanel } from "@/components/account-panel";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

type Props = {
  searchParams?: Promise<{
    password?: string;
    newToken?: string;
    lineCode?: string;
  }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const data = await getCareLog();
  const tokens = data.apiTokens.filter((token) => token.userId === user.id);
  const lineBindings = data.lineBindings.filter((binding) => binding.userId === user.id);

  return (
    <AppFrame
      active="account"
      title="帳號"
      description="管理登入、密碼與本機資料工具。"
    >
      <AccountPanel
        user={user}
        status={params?.password}
        newToken={params?.newToken}
        tokens={tokens}
        lineCode={params?.lineCode}
        lineBindings={lineBindings}
      />
    </AppFrame>
  );
}
