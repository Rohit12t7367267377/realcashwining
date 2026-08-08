import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/membership.functions";
import { useUser } from "@/lib/user-store";

/**
 * Premium state for the signed-in user. Feature codes come from the admin's
 * benefit catalogue, so new premium perks need no code change here.
 */
export function usePremium() {
  const { state } = useUser();
  const fetchFn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({
    queryKey: ["my-membership"],
    queryFn: () => fetchFn(),
    enabled: state.loggedIn,
    staleTime: 60_000,
  });

  const features = data?.features ?? [];
  return {
    loading: isLoading,
    isPremium: Boolean(data?.active),
    plan: data?.plan ?? null,
    endsAt: data?.ends_at ?? null,
    history: data?.history ?? [],
    features,
    has: (code: string) => Boolean(data?.active) && features.includes(code),
  };
}
