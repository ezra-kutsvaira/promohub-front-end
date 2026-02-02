import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roadshowEvents } from "@/data/roadshows";

const categoryOptions = ["All Categories", "Expo", "Product launch", "Trade fair", "Promo event"];
const locationOptions = ["All Locations", "Harare", "Bulawayo", "Mutare", "Gweru"];
const timeframeOptions = ["Upcoming", "This week", "This month"];

const Roadshows = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [timeframe, setTimeframe] = useState("Upcoming");

  const filteredEvents = useMemo(() => {
    return roadshowEvents.filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.organizer.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        category === "All Categories" || event.category === category;
      const matchesLocation =
        location === "All Locations" || event.location.toLowerCase().includes(location.toLowerCase());
      const matchesTimeframe = timeframe === "Upcoming" ? true : event.timeframe === timeframe;

      return matchesSearch && matchesCategory && matchesLocation && matchesTimeframe;
    });
  }, [category, location, search, timeframe]);

  const handleReset = () => {
    setSearch("");
    setCategory("All Categories");
    setLocation("All Locations");
    setTimeframe("Upcoming");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Roadshows & Events</h1>
          <p className="text-muted-foreground">
            Discover upcoming business roadshows, expos, and promotional events.
          </p>
        </motion.div>

        <div className="bg-card border border-border rounded-lg p-6 mb-10">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search events or businesses..."
                className="pl-10 h-12"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className="h-12 px-4 rounded-md border border-input bg-background text-foreground"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categoryOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <select
              className="h-12 px-4 rounded-md border border-input bg-background text-foreground"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            >
              {locationOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <select
              className="h-12 px-4 rounded-md border border-input bg-background text-foreground"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
            >
              {timeframeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <Button variant="outline" className="h-12" onClick={handleReset}>
              Reset filters
            </Button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              There are no upcoming roadshows or events at the moment.
            </h2>
            <p className="text-muted-foreground mb-6">
              Check back soon or browse current promotions.
            </p>
            <Button asChild>
              <Link to="/browse">Browse promotions</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="h-full"
              >
                <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-semibold text-foreground">{event.title}</h3>
                    {event.badge && (
                      <span className="text-xs font-semibold uppercase tracking-wide bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {event.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Hosted by {event.organizer}</p>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{event.dateRange}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{event.timeRange}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <div className="mt-auto flex flex-col sm:flex-row gap-3">
                    <Button asChild>
                      <Link to={`/roadshows/${event.id}`}>View details</Link>
                    </Button>
                    <Button variant="outline">Save event</Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Roadshows;
