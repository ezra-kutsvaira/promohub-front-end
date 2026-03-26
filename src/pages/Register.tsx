import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { BadgeCheck, FileCheck, Shield, TrendingUp } from "lucide-react";
import { useAuth, UserRole } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type AuthPayload, type BusinessDocumentType, type Category } from "@/lib/api";
import { clearStagedSession, stageSession } from "@/lib/session";

type RegisterRole  = Exclude<UserRole, "ADMIN">; 

const BUSINESS_UPLOAD_ENDPOINTS = [
  "/api/businesses/documents/upload",
  "/api/business-documents/upload",
  "/api/business-verification/documents/upload",
  "/api/business-verifications/documents/upload",
];
const BUSINESS_VERIFICATION_ENDPOINTS = [
  "/api/business-verification",
  "/api/business-verifications",
  "/api/businesses/{id}/verification",
];

const BUSINESS_CREATE_ENDPOINT = "/api/businesses";
const BUSINESS_ROLLBACK_ENDPOINTS = ["/api/users/{id}", "/api/users/me", "/api/users/self"];

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Registration failed. Please try again.";

const includesAny = (value: string, patterns: string[]) => patterns.some((pattern) => value.includes(pattern));

const normalizeReturnedUserRole = (role: string | undefined): UserRole | undefined => {
  if (!role) return undefined;

  const normalizedRole = role.trim().toUpperCase();
  if (normalizedRole === "CUSTOMER") {
    return "CONSUMER";
  }

  if (normalizedRole === "ADMIN" || normalizedRole === "BUSINESS_OWNER" || normalizedRole === "CONSUMER") {
    return normalizedRole as UserRole;
  }

  return undefined;
};

const buildBusinessRegistrationFailureMessage = (
  error: unknown,
  failedStep: string,
  rollbackFailed: boolean
) => {
  const rawMessage = normalizeErrorMessage(error).trim();
  const normalizedMessage = rawMessage.toLowerCase();
  let message = rawMessage;

  if (failedStep === "uploading business verification documents") {
    if (includesAny(normalizedMessage, ["no static resource", "not found", "404"])) {
      message =
        "Business registration failed while uploading verification documents. The backend is missing the business document upload API. It must expose an authenticated multipart POST endpoint and return a documentUrl for each uploaded file.";
    } else if (includesAny(normalizedMessage, ["method not allowed", "request method", "405"])) {
      message =
        "Business registration failed during document upload because the backend upload endpoint does not accept POST. The server must allow multipart/form-data POST requests for business verification files.";
    } else if (includesAny(normalizedMessage, ["unsupported media type", "415"])) {
      message =
        "Business registration failed during document upload because the backend rejected multipart/form-data. The server must accept a file field plus documentType when uploading business verification documents.";
    } else if (includesAny(normalizedMessage, ["unauthorized", "forbidden", "401", "403"])) {
      message =
        "Business registration failed during document upload because the backend did not accept the new account's access token. Confirm the register response returns a usable token and that upload is allowed immediately after signup.";
    }
  }

  if (failedStep === "creating the business profile") {
    if (includesAny(normalizedMessage, ["no static resource", "not found", "404"])) {
      message =
        "Business registration failed after document upload because the backend is missing the business creation API. The server must expose POST /api/businesses to store the business profile and link it to the new owner.";
    } else if (includesAny(normalizedMessage, ["method not allowed", "request method", "405"])) {
      message =
        "Business registration failed because the backend business creation endpoint does not accept POST. The server must allow POST /api/businesses for business-owner signup.";
    } else if (includesAny(normalizedMessage, ["bad request", "400"])) {
      message =
        "Business registration failed because the backend rejected the business payload. Confirm POST /api/businesses accepts ownerId, businessName, description, contactEmail, phoneNumber, category/categoryCode, address, city, country, logoUrl, and the document URL fields.";
    } else if (includesAny(normalizedMessage, ["unauthorized", "forbidden", "401", "403"])) {
      message =
        "Business registration failed while creating the business profile because the backend refused the new account's access token or role. Confirm POST /api/businesses accepts authenticated BUSINESS_OWNER requests immediately after signup.";
    }
  }

  if (failedStep === "submitting the verification record") {
    if (includesAny(normalizedMessage, ["no static resource", "not found", "404"])) {
      message =
        "Business registration created the business profile, but the backend is missing the business verification submission API. The server must expose a POST endpoint such as /api/business-verification or /api/business-verifications to store VAT, TIN, and owner national ID details.";
    } else if (includesAny(normalizedMessage, ["method not allowed", "request method", "405"])) {
      message =
        "Business registration created the business profile, but the backend verification endpoint does not accept POST. The server must allow POST requests for business verification submission.";
    } else if (includesAny(normalizedMessage, ["bad request", "400"])) {
      message =
        "Business registration created the business profile, but the backend rejected the verification details. Confirm the verification API accepts businessId, vatNumber, tinNumber, ownerNationalId, and any optional supportingDocumentsUrl fields.";
    } else if (includesAny(normalizedMessage, ["unauthorized", "forbidden", "401", "403"])) {
      message =
        "Business registration created the business profile, but the backend refused the verification submission as unauthorized. Confirm the newly created BUSINESS_OWNER token can immediately submit verification details.";
    }
  }

  if (rollbackFailed) {
    message = `${message} Cleanup also failed, so the login account may still exist. Confirm the backend allows DELETE /api/users/{id} or DELETE /api/users/me immediately after signup.`;
  }

  return message;
};

const logBusinessRegistrationDiagnostic = (
  error: unknown,
  failedStep: string,
  rollbackFailed: boolean,
  createdUserId?: number
) => {
  console.error("Business registration integration failure", {
    failedStep,
    createdUserId,
    rollbackFailed,
    error,
    expectedUploadEndpoints: BUSINESS_UPLOAD_ENDPOINTS,
    expectedBusinessCreateEndpoint: BUSINESS_CREATE_ENDPOINT,
    expectedBusinessVerificationEndpoints: BUSINESS_VERIFICATION_ENDPOINTS,
    expectedRollbackEndpoints: BUSINESS_ROLLBACK_ENDPOINTS,
  });
};

const Register = () => {
  const { establishSession, signOut } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<RegisterRole>("BUSINESS_OWNER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");

  const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg"];
  const maxFileSizeBytes = 10 * 1024 * 1024;

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
    { required, label }: { required: boolean; label: string }
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


  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.getCategories();
        setCategories(response);
      } catch (error) {
        console.warn("Unable to load categories for registration", error);
      }
    };

    loadCategories();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full-name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    let createdUserId: number | undefined;
    let createdBusinessId: number | undefined;
    let createdAuthResponse: AuthPayload | null = null;
    let currentStep = role === "BUSINESS_OWNER" ? "creating the login account" : "creating the account";

    try {
      setIsSubmitting(true);

      if (role === "BUSINESS_OWNER") {
        const taxClearanceFile = (formData.get("tax-clearance-file") as File) ?? null;
        const certifiedRegistrantIdFile = (formData.get("certified-registrant-id-file") as File) ?? null;
        const businessRegistrationCertificateFile = (formData.get("business-registration-certificate-file") as File) ?? null;
        const proofOfBusinessAddressFile = (formData.get("proof-of-business-address-file") as File) ?? null;

        if (!taxClearanceFile || taxClearanceFile.size === 0) {
          throw new Error("Tax clearance document is required.");
        }

        if (!certifiedRegistrantIdFile || certifiedRegistrantIdFile.size === 0) {
          throw new Error("Certified registrant ID document is required.");
        }

        validateDocumentFile(taxClearanceFile, "Tax clearance document");
        validateDocumentFile(certifiedRegistrantIdFile, "Certified registrant ID document");

        if (businessRegistrationCertificateFile && businessRegistrationCertificateFile.size > 0) {
          validateDocumentFile(businessRegistrationCertificateFile, "Business registration certificate");
        }

        if (proofOfBusinessAddressFile && proofOfBusinessAddressFile.size > 0) {
          validateDocumentFile(proofOfBusinessAddressFile, "Proof of business address document");
        }
      }

      const authResponse = await api.register({ fullName, email, password, role });
      createdAuthResponse = authResponse;
      createdUserId = authResponse.userId;


      if (role === "BUSINESS_OWNER") {
        if (!authResponse.accessToken?.trim()) {
          throw new Error(
            "Business-owner signup succeeded, but the backend did not return a usable access token. Document upload and business profile creation require a bearer token immediately after signup."
          );
        }

        const returnedRole = normalizeReturnedUserRole(authResponse.userRole);
        if (returnedRole && returnedRole !== "BUSINESS_OWNER") {
          throw new Error(
            `Business-owner signup created an account with role ${returnedRole} instead of BUSINESS_OWNER. The backend must persist the requested business-owner role before document upload and POST /api/businesses.`
          );
        }

        stageSession(authResponse);
        currentStep = "uploading business verification documents";

        const taxClearanceDocumentUrl = await uploadDocument(
          "TAX_CLEARANCE",
          (formData.get("tax-clearance-file") as File) ?? null,
          { required: true, label: "Tax clearance document" }
        );
        const certifiedRegistrantIdDocumentUrl = await uploadDocument(
          "CERTIFIED_REGISTRANT_ID",
          (formData.get("certified-registrant-id-file") as File) ?? null,
          { required: true, label: "Certified registrant ID document" }
        );
        const businessRegistrationCertificateUrl = await uploadDocument(
          "BUSINESS_REGISTRATION_CERTIFICATE",
          (formData.get("business-registration-certificate-file") as File) ?? null,
          { required: false, label: "Business registration certificate" }
        );
        const proofOfBusinessAddressDocumentUrl = await uploadDocument(
          "PROOF_OF_BUSINESS_ADDRESS",
          (formData.get("proof-of-business-address-file") as File) ?? null,
          { required: false, label: "Proof of business address document" }
        );
        if (!taxClearanceDocumentUrl || !certifiedRegistrantIdDocumentUrl) {
          throw new Error("Required business verification documents are missing.");
        }

        const businessPayload = {
          ownerId: authResponse.userId,
          businessName: String(formData.get("business-name") ?? ""),
          description: String(formData.get("description") ?? ""),
          contactEmail: String(formData.get("contact-email") ?? email),
          phoneNumber: String(formData.get("phone") ?? ""),
          category: String(formData.get("categoryName") ?? ""),
          categoryCode: String(formData.get("categoryCode") ?? "") || undefined,
          websiteUrl: String(formData.get("website") ?? ""),
          address: String(formData.get("address") ?? ""),
          logoUrl: String(formData.get("logo-url") ?? ""),
          city: String(formData.get("city") ?? ""),
          country: String(formData.get("country") ?? ""),
          taxClearanceDocumentUrl,
          certifiedRegistrantIdDocumentUrl,
          businessRegistrationCertificateUrl,
          proofOfBusinessAddressDocumentUrl,
        };

        currentStep = "creating the business profile";
        const createdBusiness = await api.createBusiness(businessPayload);
        createdBusinessId = createdBusiness.id;

        currentStep = "submitting the verification record";
        await api.requestBusinessVerification({
          businessId: createdBusiness.id,
          vatNumber: String(formData.get("vat-number") ?? "").trim(),
          tinNumber: String(formData.get("tin-number") ?? "").trim(),
          ownerNationalId: String(formData.get("owner-national-id") ?? "").trim(),
          supportingDocumentsUrl: businessRegistrationCertificateUrl ?? proofOfBusinessAddressDocumentUrl,
        });

        clearStagedSession();
        establishSession(authResponse);
        toast.success("Thanks! Your business registration has been submitted for review.");
      } else {
        establishSession(authResponse);
        toast.success("Your account has been created.");
      }

      navigate("/dashboard");
    } catch (error) {
      const failedStep = currentStep;
      let rollbackFailed = false;
      if (role === "BUSINESS_OWNER" && createdBusinessId) {
        currentStep = "rolling back the partial business profile";
        try {
          await api.deleteBusiness(createdBusinessId);
        } catch (rollbackBusinessError) {
          rollbackFailed = true;
          console.warn(
            "Unable to roll back partially created business after registration failure",
            rollbackBusinessError
          );
        }
      }
      if (role === "BUSINESS_OWNER" && createdUserId) {
        currentStep = "rolling back the partial account";
        try {
          await api.deleteUser(createdUserId);
        } catch (rollbackError) {
          try {
            await api.deleteCurrentUser();
          } catch (deleteCurrentUserError) {
            rollbackFailed = true;
            console.warn(
              "Unable to roll back partially created user after registration failure",
              rollbackError,
              deleteCurrentUserError
            );
          }
        }
      }
      if (createdAuthResponse?.refreshToken) {
        try {
          await api.logout(createdAuthResponse.refreshToken);
        } catch {
          // ignore logout errors during cleanup
        }
      }
      clearStagedSession();
      await signOut();
      if (role === "BUSINESS_OWNER") {
        logBusinessRegistrationDiagnostic(error, failedStep, rollbackFailed, createdUserId);
        toast.error(buildBusinessRegistrationFailureMessage(error, failedStep, rollbackFailed));
      } else {
        toast.error(normalizeErrorMessage(error));
      }
    } finally {
      clearStagedSession();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <section className="mb-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-foreground">
            Create Your PromoHub Account
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Business owners submit verification details to publish promotions. Consumers only need an account to browse, save deals, and log in.
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>{role === "BUSINESS_OWNER" ? "Verification request" : "Account registration"}</CardTitle>
              <CardDescription>
                {role === "BUSINESS_OWNER"
                  ? "Complete the form below so our team can confirm your business legitimacy."
                  : "Create your account to browse and save promotions instantly."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="role">
                    Account type
                  </label>
                  <select
                    id="role"
                    name="role"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={role}
                    onChange={(event) => setRole(event.target.value as RegisterRole)}
                  >
                    <option value="BUSINESS_OWNER">Business owner</option>
                    <option value="CONSUMER">Consumer</option>
                
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="full-name">
                      Full name
                    </label>
                    <Input id="full-name" name="full-name" placeholder="Tadiwa Moyo" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="email">
                      Email address
                    </label>
                    <Input id="email" name="email" type="email" placeholder="you@business.co.zw" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="password">
                    Password
                  </label>
                  <Input id="password" name="password" type="password" placeholder="••••••••" required />
                </div>
                {role === "BUSINESS_OWNER" && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="business-name">
                          Business name
                        </label>
                        <Input id="business-name" name="business-name" placeholder="PromoHub Retailers" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="categoryCode">
                          Business category
                        </label>
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
                        <input type="hidden" name="categoryName" value={categories.find((category) => category.code === selectedCategoryCode)?.name ?? ""} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="description">
                        Description
                      </label>
                      <Input id="description" name="description" placeholder="Short summary of your business." required />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="contact-email">
                          Contact email
                        </label>
                        <Input id="contact-email" name="contact-email" type="email" placeholder="hello@business.co.zw" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="phone">
                          Phone number
                        </label>
                        <Input id="phone" name="phone" type="tel" placeholder="+263 77 000 0000" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="vat-number">
                          VAT number
                        </label>
                        <Input id="vat-number" name="vat-number" placeholder="2200000000" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="tin-number">
                          TIN number
                        </label>
                        <Input id="tin-number" name="tin-number" placeholder="1234567890" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="owner-national-id">
                          Owner national ID
                        </label>
                        <Input id="owner-national-id" name="owner-national-id" placeholder="63-123456-A-12" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="address">
                          Address
                        </label>
                        <Input id="address" name="address" placeholder="22 Samora Machel Avenue" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="city">
                          City
                        </label>
                        <Input id="city" name="city" placeholder="Harare" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="country">
                          Country
                        </label>
                        <Input id="country" name="country" placeholder="Zimbabwe" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="logo-url">
                          Logo URL
                        </label>
                        <Input id="logo-url" name="logo-url" placeholder="https://..." required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="website">
                        Website or social handle (optional)
                      </label>
                      <Input id="website" name="website" placeholder="https://instagram.com/yourbusiness" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="tax-clearance-file">
                          Tax clearance document (required)
                        </label>
                        <Input id="tax-clearance-file" name="tax-clearance-file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="certified-registrant-id-file">
                          Certified registrant ID copy (required)
                        </label>
                        <Input id="certified-registrant-id-file" name="certified-registrant-id-file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="business-registration-certificate-file">
                          Business registration certificate (optional)
                        </label>
                        <Input id="business-registration-certificate-file" name="business-registration-certificate-file" type="file" accept=".pdf,.png,.jpg,.jpeg" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="proof-of-business-address-file">
                          Proof of business address (optional)
                        </label>
                        <Input id="proof-of-business-address-file" name="proof-of-business-address-file" type="file" accept=".pdf,.png,.jpg,.jpeg" />
                      </div>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : role === "BUSINESS_OWNER" ? "Submit verification request" : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>What happens next?</CardTitle>
                <CardDescription>
                  We keep you updated at every verification milestone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Document checks and business registry validation within 48 hours.</span>
                </div>
                <div className="flex items-start gap-3">
                  <FileCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>We schedule a verification call to confirm your point of contact.</span>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Publish trusted promotions and start reaching new customers.</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-muted/40">
              <CardHeader>
                <CardTitle>Need help?</CardTitle>
                <CardDescription>
                  Speak to our verification specialists for guidance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:verification@promohub.co.zw">Email verification team</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Register;
