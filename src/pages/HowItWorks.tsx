import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, FileCheck, TrendingUp, Bell, ShieldCheck, Users, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How PromoHub Works
            </h1>
            <p className="text-xl text-muted-foreground">
              A transparent process ensuring only verified promotions reach our customers
            </p>
          </motion.div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Step 1: Business Registration",
                description: "Businesses register on PromoHub by providing their company details, registration documents, and contact information. We require proof of business legitimacy.",
                details: [
                  "Company registration certificate",
                  "Tax clearance documents",
                  "Owner identification",
                  "Business contact details",
                ],
              },
              {
                icon: FileCheck,
                title: "Step 2: Admin Verification",
                description: "Our verification team reviews all submitted documents to ensure business authenticity. This process typically takes 24-48 hours.",
                details: [
                  "Document authenticity check",
                  "Business legitimacy verification",
                  "Contact information validation",
                  "Background checks",
                ],
              },
              {
                icon: TrendingUp,
                title: "Step 3: Promotion & Roadshow Publishing",
                description: "Once verified, businesses can create and publish promotions and roadshows. Each submission goes through a quick review to ensure accuracy.",
                details: [
                  "Create promotion details",
                  "Upload promotional materials",
                  "Set validity dates",
                  "Schedule roadshow events",
                  "Quick admin approval",
                ],
              },
              {
                icon: Bell,
                title: "Step 4: Community Monitoring",
                description: "Customers can report suspicious promotions. Our team investigates all reports and takes action against fraudulent activity.",
                details: [
                  "User reporting system",
                  "Admin investigation",
                  "Business suspension if needed",
                  "Continuous monitoring",
                ],
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="mb-12 last:mb-0"
              >
                <Card className="p-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <step.icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                      <p className="text-muted-foreground mb-4">{step.description}</p>
                      <ul className="space-y-2">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose PromoHub?</h2>
              <p className="text-muted-foreground">
                We're committed to creating a safe marketplace for promotions
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: ShieldCheck,
                  title: "100% Verified",
                  description: "Every business is thoroughly vetted before they can post promotions",
                },
                {
                  icon: Users,
                  title: "Community Trust",
                  description: "User reports and reviews help maintain platform integrity",
                },
                {
                  icon: Bell,
                  title: "Real-Time Updates",
                  description: "Get notified about new promotions from your favorite businesses",
                },
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="p-6 text-center h-full">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Whether you're looking for deals or want to promote your business, we've got you covered
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/browse">Browse Promotions</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/register">Register Your Business</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
