import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { useState } from "react";

const AccountSettings = () => {
  const { user, updateUser, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  if (!user) {
    return null;
  }

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

      <main className="container mx-auto px-4 py-10 space-y-8">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Account settings</h1>
          <p className="text-muted-foreground">
            Manage your profile, preferences, and verification status.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
              <CardDescription>Keep your information up to date.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" name="name" defaultValue={user.fullName} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" name="email" type="email" defaultValue={user.email} disabled />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Account role</Label>
                  <Input id="role" value={user.role.toLowerCase().replace("_", " ")} disabled />
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
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose how you hear from us.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Promotion reminders</p>
                    <p className="text-sm text-muted-foreground">Get alerts before deals expire.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">New deals near you</p>
                    <p className="text-sm text-muted-foreground">Highlights based on your city.</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Product updates</p>
                    <p className="text-sm text-muted-foreground">Receive product launch notes.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            {user.role === "BUSINESS_OWNER" && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Verification status</CardTitle>
                  <CardDescription>Business trust badges.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Status: {user.verified ? "Verified ✅" : "Pending review"}</p>
                  <Button variant="outline">View verification record</Button>
                </CardContent>
              </Card>
            )}

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
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input id="new-password" name="new-password" type="password" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>
                    <Input id="confirm-new-password" name="confirm-new-password" type="password" required />
                  </div>
                  <Button type="submit" disabled={isPasswordSubmitting}>
                    {isPasswordSubmitting ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Sign out of your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AccountSettings;
