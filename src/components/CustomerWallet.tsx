import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";

interface Txn {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string | null;
  created_at: string;
}

export const CustomerWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Txn[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
      setBalance(Number(w?.balance || 0));
      const { data: t } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setTxns((t as Txn[]) || []);
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Wallet balance</CardTitle>
          <Wallet className="w-5 h-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">₹{balance.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">Automatically applied at checkout on your next booking.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {txns.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No transactions yet.</p>
          ) : (
            <ul className="divide-y">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {t.type === "credit" ? (
                      <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-orange-600" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{t.description || (t.type === "credit" ? "Wallet credit" : "Booking payment")}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(t.created_at), "PP p")}</div>
                    </div>
                  </div>
                  <Badge variant={t.type === "credit" ? "default" : "secondary"}>
                    {t.type === "credit" ? "+" : "-"}₹{Number(t.amount).toFixed(2)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};