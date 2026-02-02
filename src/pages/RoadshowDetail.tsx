import { Link, useParams } from "react-router-dom";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { roadshowEvents } from "@/data/roadshows";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

const RoadshowDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const event = roadshowEvents.find((item) => item.id === id);

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Event not found</h1>
          <p className="text-muted-foreground mb-6">
            The event you are looking for is not available.
          </p>
          <Button asChild>
            <Link to="/roadshows">Back to events</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    toast.success("Event saved! We'll keep it in your saved list.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-3">{event.title}</h1>
            <p className="text-muted-foreground mb-4">Hosted by {event.organizer}</p>
            <div className="flex flex-col gap-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{event.dateRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{event.timeRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{event.venue}</span>
              </div>
            </div>
          </div>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Event description</h2>
            <p className="text-muted-foreground leading-relaxed">{event.overview}</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Key details</h2>
            <div className="bg-card border border-border rounded-xl p-6 space-y-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Venue: {event.venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Start date: {event.startDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>End date: {event.endDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Time: {event.timeRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">🏷️</span>
                <span>Category: {event.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">💼</span>
                <span>Organizer: {event.organizer}</span>
              </div>
            </div>
          </section>

          {event.whatToExpect && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-foreground mb-3">What to expect</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                {event.whatToExpect.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Actions</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated ? (
                <Button onClick={handleSave}>Save event</Button>
              ) : (
                <Button asChild>
                  <Link to="/login">Save event</Link>
                </Button>
              )}
              {event.contactEmail && (
                <Button variant="outline" asChild>
                  <a href={`mailto:${event.contactEmail}`}>Contact organizer</a>
                </Button>
              )}
            </div>
          </section>

          <section className="border-t border-border pt-6 text-sm text-muted-foreground space-y-2">
            <p>Events are posted by verified businesses where possible.</p>
            <a href="#" className="text-primary hover:text-primary/80">
              Report incorrect information
            </a>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RoadshowDetail;
