import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, FileCheck, Shield, Store } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { api, type AuthPayload, type Business, type BusinessDocumentType, type BusinessVerificationReview, type Category } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to submit your business owner account request.";

const normalizeReturnedUserRole = (role: string | null | undefined) => {
  const normalizedRole = role?.trim().toUpperCase();

  if (!normalizedRole) {
    return null;
  }

  if (normalizedRole === "CUSTOMER") {
    return "CONSUMER";
  }

  if (normalizedRole === "ADMIN" || normalizedRole === "BUSINESS_OWNER" || normalizedRole === "CONSUMER") {
    return normalizedRole;
  }

  return normalizedRole;
};

const CreateBusinessOwnerAccount = () => {
  const { user, establishSession } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingExistingBusiness, setIsCheckingExistingBusiness] = useState(false);
  const [existingBusiness, setExistingBusiness] = useState<Business | null>(null);
  const [existingVerification, setExistingVerification] = useState<BusinessVerificationReview | null>(null);

  const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg"];
  const maxFileSizeBytes = 10 * 1024 * 1024;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.getCategories();
        setCategories(response);
      } catch (error) {
        console.warn("Unable to load categories for business owner onboarding", error);
      }
    };

    void loadCategories();
  }, []);

  useEffect(() => {
    if (!user || user.role !== "BUSINESS_OWNER") {
      return;
    }

    let isMounted = true;

    const loadExistingBusiness = async () => {
      try {
        setIsCheckingExistingBusiness(true);
        const business = await api.getCurrentUserBusiness(user.id);
        if (!isMounted) {
          return;
        }

        setExistingBusiness(business);
        const verification = await api.getBusinessVerification(business.id).catch(() => null);
        if (!isMounted) {
          return;
        }
        setExistingVerification(verification);
      } catch (error) {
        if (isMounted) {
          setExistingBusiness(null);
          setExistingVerification(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingExistingBusiness(false);
        }
      }
    };

    void loadExistingBusiness();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const isBusinessOwner = user.role === "BUSINESS_OWNER";
  const pageTitle = isBusinessOwner ? "Complete your business owner setup" : "Create Business Owner Account";
  const pageDescription = isBusinessOwner
    ? "Finish submitting your business information and verification documents so admins can review your account."
    : "Use your current customer login, submit your business details and required documents, and send the account for admin approval.";

  const validateDocumentFile = (file: File, label: string) => {
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error(`${label}: only PDF, PNG, JPG, and JPEG files are allowed.`);
    }

    if (file.size > maxFileSizeBytes) {
      throw new Error(`${label}: file size must be 10MB or less.`);
    }
  };

  const uploadDocument = async (
    documentType: BusinessDocumentType,
    file: File | null,
    { required, label }: { required: boolean; label: string },
  ) => {
    if (!file || file.size === 0) {
      if (required) {
        throw new Error(`${label} is required.`);
      }
      return undefined;
    }

    validateDocumentFile(file, label);
    const uploaded = await api.uploadBusinessDocument(documentType, file);
    return uploaded.documentUrl;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isBusinessOwner && !confirmUpgrade) {
      toast.error("Please confirm that you want to upgrade this account before continuing.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    let resolvedUserId = user.id;
    let upgradeResponse: AuthPayload | null = null;
    let createdBusinessId: number | undefined;

    try {
      setIsSubmitting(true);

      const taxClearanceFile = (formData.get("tax-clearance-file") as File) ?? null;
      const certifiedRegistrantIdFile = (formData.get("certified-registrant-id-file") as File) ?? null;
      const businessRegistrationCertificateFile =
        (formData.get("business-registration-certificate-file") as File) ?? null;
      const proofOfBusinessAddressFile = (formData.get("proof-of-business-address-file") as File) ?? null;

      if (!taxClearanceFile || taxClearanceFile.size === 0) {
        throw new Error("Tax clearance document is required.");
      }

      if (!certifiedRegistrantIdFile || certifiedRegistrantIdFile.size === 0) {
        throw new Error("Certified registrant ID document is required.");
      }

      if (!isBusinessOwner) {
        upgradeResponse = await api.upgradeCurrentUserToBusinessOwner();

        if (!upgradeResponse.accessToken?.trim()) {
          throw new Error(
            "Account upgrade succeeded, but the backend did not return a usable access token. Business document upload and profile creation need a bearer token immediately after the role change.",
          );
        }

        const returnedRole = normalizeReturnedUserRole(upgradeResponse.userRole);
        if (returnedRole && returnedRole !== "BUSINESS_OWNER") {
          throw new Error(
            `Account upgrade returned role ${returnedRole} instead of BUSINESS_OWNER. Confirm the upgrade endpoint updates the stored user role before business onboarding continues.`,
          );
        }

        establishSession(upgradeResponse);
        resolvedUserId = upgradeResponse.userId;
      }

      const taxClearanceDocumentUrl = await uploadDocument(
        "TAX_CLEARANCE",
        taxClearanceFile,
        { required: true, label: "Tax clearance document" },
      );
      const certifiedRegistrantIdDocumentUrl = await uploadDocument(
        "CERTIFIED_REGISTRANT_ID",
        certifiedRegistrantIdFile,
        { required: true, label: "Certified registrant ID document" },
      );
      const businessRegistrationCertificateUrl = await uploadDocument(
        "BUSINESS_REGISTRATION_CERTIFICATE",
        businessRegistrationCertificateFile,
        { required: false, label: "Business registration certificate" },
      );
      const proofOfBusinessAddressDocumentUrl = await uploadDocument(
        "PROOF_OF_BUSINESS_ADDRESS",
        proofOfBusinessAddressFile,
        { required: false, label: "Proof of business address document" },
      );

      if (!taxClearanceDocumentUrl || !certifiedRegistrantIdDocumentUrl) {
        throw new Error("Required business verification documents are missing.");
      }

      const businessPayload = {
        ownerId: resolvedUserId,
        businessName: String(formData.get("business-name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        contactEmail: String(formData.get("contact-email") ?? user.email).trim(),
        phoneNumber: String(formData.get("phone") ?? "").trim(),
        category: String(formData.get("categoryName") ?? "").trim(),
        categoryCode: String(formData.get("categoryCode") ?? "") || undefined,
        websiteUrl: String(formData.get("website") ?? "").trim(),
        address: String(formData.get("address") ?? "").trim(),
        logoUrl: String(formData.get("logo-url") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        country: String(formData.get("country") ?? "").trim(),
        taxClearanceDocumentUrl,
        certifiedRegistrantIdDocumentUrl,
        businessRegistrationCertificateUrl,
        proofOfBusinessAddressDocumentUrl,
      };

      const createdBusiness = await api.createBusiness(businessPayload);
      createdBusinessId = createdBusiness.id;

      await api.requestBusinessVerification({
        businessId: createdBusiness.id,
        vatNumber: String(formData.get("vat-number") ?? "").trim(),
        tinNumber: String(formData.get("tin-number") ?? "").trim(),
        ownerNationalId: String(formData.get("owner-national-id") ?? "").trim(),
        supportingDocumentsUrl:
          businessRegistrationCertificateUrl ?? proofOfBusinessAddressDocumentUrl,
      });

      toast.success(
        upgradeResponse
          ? "Your business owner account has been created and submitted for admin approval."
          : "Your business owner application has been submitted for admin approval.",
      );
      navigate("/dashboard");
    } catch (error) {
      if (createdBusinessId) {
        try {
          await api.deleteBusiness(createdBusinessId);
        } catch (rollbackError) {
          console.warn("Unable to roll back partially created business after upgrade failure", rollbackError);
        }
      }

      const baseMessage = normalizeErrorMessage(error);
      const message =
        upgradeResponse && !createdBusinessId
          ? `${baseMessage} Your account role has already been upgraded, so you can retry this form to finish setup.`
          : baseMessage;

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const verificationStatus =
    existingVerification?.status ??
    existingBusiness?.businessVerificationStatus ??
    (existingBusiness?.verified ? "VERIFIED" : null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <section className="mb-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-foreground md:text-4xl">{pageTitle}</h1>
          <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">{pageDescription}</p>
        </section>

        {isCheckingExistingBusiness ? (
          <Card className="mx-auto max-w-3xl border-border">
            <CardContent className="py-10 text-center text-muted-foreground">
              Checking your business owner setup...
            </CardContent>
          </Card>
        ) : existingBusiness ? (
          <Card className="mx-auto max-w-3xl border-border">
            <CardHeader>
              <CardTitle>Business owner setup already submitted</CardTitle>
              <CardDescription>
                Your business profile for {existingBusiness.businessName} is already on record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="font-medium text-foreground">Current review status</p>
                <p className="mt-1">{verificationStatus ?? "Pending review"}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/account-settings?section=notifications">Manage notifications</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-8 lg:grid-cols-[2fr,1fr]">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>
                  {isBusinessOwner ? "Business owner application" : "Upgrade this account"}
                </CardTitle>
                <CardDescription>
                  Submit the business information and supporting documents required for admin review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  {!isBusinessOwner && (
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="confirm-upgrade"
                          checked={confirmUpgrade}
                          onCheckedChange={(checked) => setConfirmUpgrade(Boolean(checked))}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="confirm-upgrade" className="cursor-pointer">
                            Confirm account upgrade
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            I understand that this will upgrade my current consumer account into a
                            business owner account and use the same login details I already have.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-name">Business name</Label>
                      <Input id="business-name" name="business-name" placeholder="PromoHub Retailers" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="categoryCode">Business category</Label>
                      <select
                        id="categoryCode"
                        name="categoryCode"
                        value={selectedCategoryCode}
                        onChange={(event) => setSelectedCategoryCode(event.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        <option value="">Select a category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.code}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="hidden"
                        name="categoryName"
                        value={categories.find((category) => category.code === selectedCategoryCode)?.name ?? ""}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Tell admins what your business does and who it serves."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Contact email</Label>
                      <Input
                        id="contact-email"
                        name="contact-email"
                        type="email"
                        placeholder={user.email}
                        defaultValue={user.email}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="+263 77 000 0000" required />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="vat-number">VAT number</Label>
                      <Input id="vat-number" name="vat-number" placeholder="2200000000" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tin-number">TIN number</Label>
                      <Input id="tin-number" name="tin-number" placeholder="1234567890" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-national-id">Owner national ID</Label>
                      <Input
                        id="owner-national-id"
                        name="owner-national-id"
                        placeholder="63-123456-A-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" name="address" placeholder="22 Samora Machel Avenue" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" name="city" placeholder="Harare" required />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" name="country" placeholder="Zimbabwe" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo-url">Logo URL</Label>
                      <Input id="logo-url" name="logo-url" placeholder="https://..." required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website or social handle (optional)</Label>
                    <Input
                      id="website"
                      name="website"
                      placeholder="https://instagram.com/yourbusiness"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tax-clearance-file">Tax clearance document (required)</Label>
                      <Input
                        id="tax-clearance-file"
                        name="tax-clearance-file"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="certified-registrant-id-file">
                        Certified registrant ID copy (required)
                      </Label>
                      <Input
                        id="certified-registrant-id-file"
                        name="certified-registrant-id-file"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-registration-certificate-file">
                        Business registration certificate (optional)
                      </Label>
                      <Input
                        id="business-registration-certificate-file"
                        name="business-registration-certificate-file"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proof-of-business-address-file">
                        Proof of business address (optional)
                      </Label>
                      <Input
                        id="proof-of-business-address-file"
                        name="proof-of-business-address-file"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Submitting..."
                      : isBusinessOwner
                        ? "Submit for approval"
                        : "Create Business Owner Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle>What happens next?</CardTitle>
                  <CardDescription>
                    We review your documents and keep you updated through notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Your current account is upgraded for business-owner access.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Admins review your business information, tax documents, and ID copy.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-4 w-4 text-primary" />
                    <span>You will receive approval or rejection updates in your notification center.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-muted/40">
                <CardHeader>
                  <CardTitle>Need help?</CardTitle>
                  <CardDescription>
                    Reach out if you need guidance before submitting your application.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full" asChild>
                    <a href="mailto:verification@promohub.co.zw">Email verification team</a>
                  </Button>
                  <Button variant="ghost" className="w-full" asChild>
                    <Link to="/dashboard">Back to dashboard</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CreateBusinessOwnerAccount;
