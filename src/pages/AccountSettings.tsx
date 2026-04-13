import { useState } from "react";
import { useLocation } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { NotificationPreferencesPanel } from "@/components/NotificationPreferencesPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

const AccountSettings = () => {
  const { user, updateUser, signOut } = useAuth();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  if (!user) {
    return null;
  }

  const requestedSection = new URLSearchParams(location.search).get("section");
  const defaultTab =
    requestedSection === "profile" ||
    requestedSection === "notifications" ||
    requestedSection === "security"
      ? requestedSection
      : "profile";

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("name") ?? user.fullName);
    const profileImageURL = String(formData.get("profileImageURL") ?? "");

    try {
      setIsSubmitting(true);
      await updateUser({ fullName, profileImageURL });
      toast.success("Your profile details have been updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("current-password") ?? "");
    const newPassword = String(formData.get("new-password") ?? "");
    const confirmNewPassword = String(formData.get("confirm-new-password") ?? "");

    try {
      setIsPasswordSubmitting(true);
      await api.changePassword(user.id, { currentPassword, newPassword, confirmNewPassword });
      toast.success("Your password has been updated.");
      event.currentTarget.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password.";
      toast.error(message);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto space-y-8 px-4 py-10">
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {user.role.toLowerCase().replace("_", " ")} account
              </Badge>
              <Badge variant={user.verified ? "default" : "secondary"}>
                {user.verified ? "Verified" : "Pending verification"}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Account settings</h1>
            <p className="max-w-3xl text-muted-foreground">
              Keep your profile, notification delivery, and security controls easy to review from
              one place.
            </p>
          </div>
        </section>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/60 p-1 md:w-fit">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Profile details</CardTitle>
                  <CardDescription>
                    Keep your personal account information up to date.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" name="name" defaultValue={user.fullName} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input id="email" name="email" type="email" defaultValue={user.email} disabled />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="role">Account role</Label>
                        <Input id="role" value={user.role.toLowerCase().replace("_", " ")} disabled />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="profileImageURL">Profile image URL</Label>
                      <Input id="profileImageURL" name="profileImageURL" placeholder="https://..." />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Account overview</CardTitle>
                    <CardDescription>
                      A quick snapshot of the account you are managing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <p className="font-medium text-foreground">Primary email</p>
                      <p className="mt-1">{user.email}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <p className="font-medium text-foreground">Account status</p>
                      <p className="mt-1">
                        {user.verified
                          ? "This account has completed verification successfully."
                          : "Verification is still pending or not required yet."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {user.role === "BUSINESS_OWNER" && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle>Verification status</CardTitle>
                      <CardDescription>Business trust and review progress.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>Status: {user.verified ? "Verified" : "Pending review"}</p>
                      <p>
                        Verification helps your promotions move through moderation with the right
                        business context attached.
                      </p>
                      <Button variant="outline">View verification record</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <section>
              <Card className="border-border bg-muted/20">
                <CardContent className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Notification delivery</p>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                      Each alert type opens on demand now, so you can focus on one notification rule
                      at a time instead of scanning a crowded wall of switches and inputs.
                    </p>
                  </div>
                  <Badge variant="outline">Cleaner view</Badge>
                </CardContent>
              </Card>
            </section>

            <NotificationPreferencesPanel />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Change password</CardTitle>
                  <CardDescription>Update your account password securely.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">Current password</Label>
                      <Input id="current-password" name="current-password" type="password" required />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input id="new-password" name="new-password" type="password" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="confirm-new-password">Confirm new password</Label>
                        <Input
                          id="confirm-new-password"
                          name="confirm-new-password"
                          type="password"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={isPasswordSubmitting}>
                      {isPasswordSubmitting ? "Updating..." : "Update password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Session control</CardTitle>
                    <CardDescription>End access from this device when you are done.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Signing out clears your current session from this browser and returns you to
                      the login flow.
                    </p>
                    <Button variant="destructive" onClick={() => void signOut()}>
                      Sign out
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Password tips</CardTitle>
                    <CardDescription>Simple ways to keep the account safer.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Use a unique password you are not reusing anywhere else.</p>
                    <p>Store it in a password manager if you need help remembering it.</p>
                    <p>Update it immediately if you suspect anyone else has seen it.</p>
                  </CardContent>
                </Card>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccountSettings;
