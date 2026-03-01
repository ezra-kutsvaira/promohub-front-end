import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useState } from "react";
import { toast } from "@/components/ui/sonner";

type OperationRecord = Record<string, unknown>;
type OperationData = {
  action: string;
  value: unknown;
};

const statusLabels = ["PENDING", "APPROVED", "REJECTED", "ACTIVE", "RESOLVED", "OPEN"];

const isRecord = (value: unknown): value is OperationRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toTitle = (label: string) =>
  label
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value !== "string") return JSON.stringify(value);

  const maybeDate = new Date(value);
  if (!Number.isNaN(maybeDate.getTime()) && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return maybeDate.toLocaleString();
  }
  return value;
};

const unwrapListPayload = (value: unknown): OperationRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value) && Array.isArray(value.content)) {
    return value.content.filter(isRecord);
  }
  return [];
};

const getRecordStatus = (item: OperationRecord): string | null => {
  const raw = item.verificationStatus ?? item.status;
  if (typeof raw !== "string") return null;
  return raw.toUpperCase();
};

const ResultsTable = ({ rows }: { rows: OperationRecord[] }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records found for this filter.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const label = String(row.title ?? row.businessName ?? row.fullName ?? row.id ?? `Result ${index + 1}`);
        const status = getRecordStatus(row);
        return (
          <Card key={String(row.id ?? index)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{label}</CardTitle>
                {status && <Badge variant="secondary">{toTitle(status)}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {Object.entries(row).map(([key, cell]) => (
                  <div key={key} className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{toTitle(key)}</dt>
                    <dd className="text-sm break-words">{formatValue(cell)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const ResultRenderer = ({ data }: { data: OperationData | null }) => {
  if (!data) {
    return <p className="text-sm text-muted-foreground">No actions run yet.</p>;
  }

  const rows = unwrapListPayload(data.value);
  const isList = rows.length > 0;
  const statuses = Array.from(
    new Set(rows.map(getRecordStatus).filter((item): item is string => Boolean(item)))
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <span className="font-medium">Last action:</span> {data.action}
      </div>

      {isList ? (
        statuses.length > 0 ? (
          <Tabs defaultValue="ALL" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
              <TabsTrigger value="ALL">All ({rows.length})</TabsTrigger>
              {statusLabels
                .filter((status) => statuses.includes(status))
                .map((status) => {
                  const count = rows.filter((row) => getRecordStatus(row) === status).length;
                  return (
                    <TabsTrigger key={status} value={status}>
                      {toTitle(status)} ({count})
                    </TabsTrigger>
                  );
                })}
              {statuses
                .filter((status) => !statusLabels.includes(status))
                .map((status) => {
                  const count = rows.filter((row) => getRecordStatus(row) === status).length;
                  return (
                    <TabsTrigger key={status} value={status}>
                      {toTitle(status)} ({count})
                    </TabsTrigger>
                  );
                })}
            </TabsList>

            <TabsContent value="ALL"><ResultsTable rows={rows} /></TabsContent>
            {statuses.map((status) => (
              <TabsContent key={status} value={status}>
                <ResultsTable rows={rows.filter((row) => getRecordStatus(row) === status)} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ResultsTable rows={rows} />
        )
      ) : isRecord(data.value) ? (
        <ResultsTable rows={[data.value]} />
      ) : (
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">{JSON.stringify(data.value ?? { success: true }, null, 2)}</pre>
      )}
    </div>
  );
};

const execute = async (action: () => Promise<unknown>, onResult: (value: unknown) => void) => {
  try {
    const result = await action();
    onResult(result);
    toast.success("Request completed successfully.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Request failed");
  }
};

const OperationsConsole = () => {
  const [output, setOutput] = useState<OperationData | null>(null);
  const [email, setEmail] = useState("");
  const [passwordToken, setPasswordToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [id, setId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [notes, setNotes] = useState("");

  const toId = () => Number(id);

  const show = (action: string, value: unknown) => {
    setOutput({ action, value: value ?? { success: true } });
  };

  const runAction = (label: string, action: () => Promise<unknown>) => execute(action, (value) => show(label, value));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Operations Console</h1>
          <p className="text-muted-foreground">Directly invoke all backend endpoints needed for end-to-end testing.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shared Inputs</CardTitle>
            <CardDescription>Provide values once and reuse across actions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Primary ID</Label><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="User/Business/Promotion/Event/Report ID" /></div>
            <div className="space-y-2"><Label>Secondary ID</Label><Input value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)} placeholder="Notification or subscription ID" /></div>
            <div className="space-y-2"><Label>Password reset token / MFA code</Label><Input value={passwordToken} onChange={(e) => setPasswordToken(e.target.value)} /></div>
            <div className="space-y-2"><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notes / reason</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><CardTitle>Auth + MFA</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Request password reset", () => api.requestPasswordReset(email))}>Request password reset</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Confirm password reset", () => api.confirmPasswordReset({ token: passwordToken, newPassword, confirmNewPassword: newPassword }))}>Confirm password reset</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Setup MFA", () => api.setupMfa())}>Setup MFA</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Enable MFA", () => api.enableMfa(passwordToken))}>Enable MFA</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Disable MFA", () => api.disableMfa(passwordToken))}>Disable MFA</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>User management</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Get user by id", () => api.getUser(toId()))}>GET user by id</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get user by email", () => api.getUserByEmail(email))}>GET user by email</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get users", () => api.getUsers())}>GET users</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Verify user", () => api.verifyUser(toId()))}>Verify user</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Delete user", () => api.deleteUser(toId()))}>Delete user</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Business + verification</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Get business by id", () => api.getBusiness(toId()))}>GET business by id</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get businesses", () => api.getBusinesses())}>GET businesses</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Delete business", () => api.deleteBusiness(toId()))}>Delete business</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get verification by id", () => api.getBusinessVerification(toId()))}>GET verification by id</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Approve verification", () => api.approveBusinessVerification(toId()))}>Approve verification</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Reject verification", () => api.rejectBusinessVerification(toId(), notes))}>Reject verification</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Promotion management</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Create promotion", () => api.createPromotion({ businessId: toId(), categoryId: 1, title: "Test promotion", description: notes || "Smoke test", imageUrl: "", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), promoCode: "SMOKE", discountType: "PERCENTAGE", discountValue: 10, termsAndConditions: "Test", location: "Harare" }))}>Create promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Update promotion", () => api.updatePromotion(toId(), { businessId: toId(), categoryId: 1, title: "Updated promotion", description: notes || "Updated", imageUrl: "", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), promoCode: "SMOKE2", discountType: "PERCENTAGE", discountValue: 15, termsAndConditions: "Updated", location: "Harare" }))}>Update promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Delete promotion", () => api.deletePromotion(toId()))}>Delete promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get promotion engagement", () => api.getPromotionEngagement(toId()))}>GET promotion engagement</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Events + reports + analytics</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Create event", () => api.createEvent({ businessId: toId(), title: "Test event", description: notes || "Smoke test", location: "Bulawayo", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), perks: "Perks" }))}>Create event</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Update event", () => api.updateEvent(toId(), { businessId: toId(), title: "Updated event", description: notes || "Updated", location: "Bulawayo", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), perks: "Perks" }))}>Update event</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Delete event", () => api.deleteEvent(toId()))}>Delete event</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get report by id", () => api.getReport(toId()))}>GET report by id</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get reports", () => api.getReports())}>GET reports</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Resolve report", () => api.resolveReport(toId(), notes))}>Resolve report</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get business analytics", () => api.getBusinessAnalytics(toId()))}>GET business analytics</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Notifications + admin modules</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => runAction("Mark notification read", () => api.markNotificationRead(secondaryId))}>Mark notification read</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Create subscription", () => api.createNotificationSubscription({ channel: "EMAIL", destination: email }))}>Create subscription</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Delete subscription", () => api.deleteNotificationSubscription(secondaryId))}>Delete subscription</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Get subscriptions", () => api.getNotificationSubscriptions())}>GET subscriptions</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Admin promotions review", () => api.getAdminPromotions())}>Admin promotions review</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Admin events review", () => api.getAdminEvents())}>Admin events review</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Admin businesses review", () => api.getAdminBusinesses())}>Admin businesses review</Button>
            <Button className="w-full" variant="outline" onClick={() => runAction("Security audit logs", () => api.getSecurityAuditLogs())}>Security audit logs</Button>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Response output</CardTitle>
            <CardDescription>Results are grouped and formatted for easy review instead of raw JSON.</CardDescription>
          </CardHeader>
          <CardContent><ResultRenderer data={output} /></CardContent>
        </Card>
      </main>
    </div>
  );
};

export default OperationsConsole;
