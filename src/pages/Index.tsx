import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Scissors, Calendar, Star, MapPin, Clock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, userRole, isLoading } = useAuth();
  
  const getOwnerButtonLink = () => {
    if (user && userRole === "owner") {
      return "/owner/dashboard";
    }
    return "/auth?mode=owner";
  };

  const getOwnerButtonText = () => {
    if (user && userRole === "owner") {
      return "Manage My Salons";
    }
    return "List Your Salon";
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero py-20">
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
              Your Perfect Salon
              <br />
              <span className="text-accent">Just a Click Away</span>
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Discover the best salons in your city. Book appointments instantly and get premium grooming services.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90 shadow-elevated">
                <Link to="/saloons">Browse Salons</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white text-white hover:bg-white hover:text-primary">
                <Link to={getOwnerButtonLink()}>{getOwnerButtonText()}</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose SaloonBook?</h2>
            <p className="text-muted-foreground text-lg">Everything you need for hassle-free salon bookings</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-lg gradient-saffron flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
              <p className="text-muted-foreground">
                Select your preferred time slot and book instantly. No phone calls, no waiting.
              </p>
            </Card>

            <Card className="p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-lg gradient-saffron flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Find Nearby Salons</h3>
              <p className="text-muted-foreground">
                Discover top-rated salons in your area with detailed reviews and ratings.
              </p>
            </Card>

            <Card className="p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-lg gradient-saffron flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Quality Service</h3>
              <p className="text-muted-foreground">
                All salons are verified and rated by real customers for your peace of mind.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Get groomed in 3 simple steps</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-saffron flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Browse & Select</h3>
              <p className="text-muted-foreground">Find the perfect salon near you</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-saffron flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">Choose Time</h3>
              <p className="text-muted-foreground">Pick your preferred date & slot</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-saffron flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">Get Groomed</h3>
              <p className="text-muted-foreground">Visit and enjoy your service</p>
            </div>
          </div>
        </div>
      </section>

      {/* For Salon Owners */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 md:p-12 shadow-elevated gradient-card">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="w-16 h-16 rounded-2xl gradient-saffron flex items-center justify-center mb-6">
                    <Scissors className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Are You a Salon Owner?</h2>
                  <p className="text-muted-foreground mb-6">
                    Join SaloonBook and reach thousands of customers. Manage bookings, showcase services, and grow your business online.
                  </p>
                  <Button size="lg" className="bg-secondary hover:bg-secondary/90" asChild>
                    <Link to={getOwnerButtonLink()}>
                      {user && userRole === "owner" ? "Go to Dashboard" : "Register Your Salon"}
                    </Link>
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Save Time</h4>
                      <p className="text-sm text-muted-foreground">Automated booking management</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Star className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Build Reputation</h4>
                      <p className="text-sm text-muted-foreground">Get reviews and ratings</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Secure Payments</h4>
                      <p className="text-sm text-muted-foreground">Track all transactions</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-muted-foreground">
          <p>&copy; 2024 SaloonBook. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;