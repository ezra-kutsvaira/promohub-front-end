import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useState } from "react";
import { toast } from "@/components/ui/sonner";

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
  const [output, setOutput] = useState("No actions run yet.");
  const [email, setEmail] = useState("");
  const [passwordToken, setPasswordToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [id, setId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [notes, setNotes] = useState("");

  const toId = () => Number(id);

  const show = (value: unknown) => {
    setOutput(JSON.stringify(value ?? { success: true }, null, 2));
  };

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
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.requestPasswordReset(email), show)}>Request password reset</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.confirmPasswordReset({ token: passwordToken, newPassword, confirmNewPassword: newPassword }), show)}>Confirm password reset</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.setupMfa(), show)}>Setup MFA</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.enableMfa(passwordToken), show)}>Enable MFA</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.disableMfa(passwordToken), show)}>Disable MFA</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>User management</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getUser(toId()), show)}>GET user by id</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getUserByEmail(email), show)}>GET user by email</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getUsers(), show)}>GET users</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.verifyUser(toId()), show)}>Verify user</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.deleteUser(toId()), show)}>Delete user</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Business + verification</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getBusiness(toId()), show)}>GET business by id</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getBusinesses(), show)}>GET businesses</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.deleteBusiness(toId()), show)}>Delete business</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getBusinessVerification(toId()), show)}>GET verification by id</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.approveBusinessVerification(toId()), show)}>Approve verification</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.rejectBusinessVerification(toId(), notes), show)}>Reject verification</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Promotion management</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.createPromotion({ businessId: toId(), categoryId: 1, title: "Test promotion", description: notes || "Smoke test", imageUrl: "", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), promoCode: "SMOKE", discountType: "PERCENTAGE", discountValue: 10, termsAndConditions: "Test", location: "Harare" }), show)}>Create promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.updatePromotion(toId(), { businessId: toId(), categoryId: 1, title: "Updated promotion", description: notes || "Updated", imageUrl: "", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), promoCode: "SMOKE2", discountType: "PERCENTAGE", discountValue: 15, termsAndConditions: "Updated", location: "Harare" }), show)}>Update promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.deletePromotion(toId()), show)}>Delete promotion</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getPromotionEngagement(toId()), show)}>GET promotion engagement</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Events + reports + analytics</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.createEvent({ businessId: toId(), title: "Test event", description: notes || "Smoke test", location: "Bulawayo", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), perks: "Perks" }), show)}>Create event</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.updateEvent(toId(), { businessId: toId(), title: "Updated event", description: notes || "Updated", location: "Bulawayo", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), perks: "Perks" }), show)}>Update event</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.deleteEvent(toId()), show)}>Delete event</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getReport(toId()), show)}>GET report by id</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getReports(), show)}>GET reports</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.resolveReport(toId(), notes), show)}>Resolve report</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getBusinessAnalytics(toId()), show)}>GET business analytics</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Notifications + admin modules</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.markNotificationRead(secondaryId), show)}>Mark notification read</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.createNotificationSubscription({ channel: "EMAIL", destination: email }), show)}>Create subscription</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.deleteNotificationSubscription(secondaryId), show)}>Delete subscription</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getNotificationSubscriptions(), show)}>GET subscriptions</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getAdminPromotions(), show)}>Admin promotions review</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getAdminEvents(), show)}>Admin events review</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getAdminBusinesses(), show)}>Admin businesses review</Button>
            <Button className="w-full" variant="outline" onClick={() => execute(() => api.getSecurityAuditLogs(), show)}>Security audit logs</Button>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Response output</CardTitle></CardHeader>
          <CardContent><pre className="text-xs bg-muted p-4 rounded-md overflow-auto">{output}</pre></CardContent>
        </Card>
      </main>
    </div>
  );
};

export default OperationsConsole;
