import { Link, useParams } from "react-router-dom";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { api, type Event } from "@/lib/api";
import { formatDate, formatDateRange } from "@/lib/format";
import { toast } from "@/components/ui/sonner";

const RoadshowDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadEvent = async () => {
      try {
        if (!id) {
          return;
        }
        const data = await api.getEvent(id);
        if (isMounted) {
          setEvent(data);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load event.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Event not found</h1>
          <p className="text-muted-foreground mb-6">
            {isLoading ? "Loading event details..." : "The event you are looking for is not available."}
          </p>
          <Button asChild>
            <Link to="/roadshows">Back to events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-3">{event.title}</h1>
            <p className="text-muted-foreground mb-4">Hosted by {event.businessName}</p>
            <div className="flex flex-col gap-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDateRange(event.startDate, event.endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>All day</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            </div>
          </div>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Event description</h2>
            <p className="text-muted-foreground leading-relaxed">{event.description || "No description provided."}</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Key details</h2>
            <div className="bg-card border border-border rounded-xl p-6 space-y-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Venue: {event.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Start date: {formatDate(event.startDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>End date: {formatDate(event.endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Time: All day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">🏷️</span>
                <span>Status: {event.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">💼</span>
                <span>Organizer: {event.businessName}</span>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Actions</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" asChild>
                <Link to="/browse">Browse promotions</Link>
              </Button>
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
