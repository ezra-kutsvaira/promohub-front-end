import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

const AccountSettings = () => {
  const { user, updateUser, signOut } = useAuth();

  if (!user) {
    return null;
  }

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? user.name);
    const email = String(formData.get("email") ?? user.email);
    updateUser({ name, email });
    toast.success("Your profile details have been updated.");
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
                  <Input id="name" name="name" defaultValue={user.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" name="email" type="email" defaultValue={user.email} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Account role</Label>
                  <Input id="role" value={user.role} disabled />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit">Save changes</Button>
                  <Button variant="outline" type="button">
                    Reset password
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

            {user.role === "business" && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Verification status</CardTitle>
                  <CardDescription>Business trust badges.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Status: Verified ✅</p>
                  <p>Documents last reviewed on 12 Oct 2025.</p>
                  <Button variant="outline">View verification record</Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Sign out of your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={signOut}>
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
