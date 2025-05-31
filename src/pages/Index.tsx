
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, BookOpen, Users, Bot, BarChart3 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Self-Custody Trading",
      description: "Your funds remain in your wallet. Trade with complete control and transparency."
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: "AI Signal Assistance",
      description: "Get intelligent trading signals from our AI system to enhance your strategy."
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: "Education Platform",
      description: "Learn forex trading with our comprehensive courses and mentorship programs."
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Professional Charts",
      description: "TradingView integration for advanced technical analysis and charting tools."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Community",
      description: "Join our trading community on Discord and Telegram for support and insights."
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Demo & Live Trading",
      description: "Practice with demo accounts or trade live with real funds seamlessly."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center justify-center flex-1 md:flex-none md:justify-start">
            <img 
              src="/lovable-uploads/de844a80-a7e2-4449-b7ea-cecb59ff1b0d.png" 
              alt="ShTrader Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">Beta Version</Badge>
            <Button onClick={() => navigate('/dashboard')}>
              Launch App
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Decentralized Forex Trading
            <span className="text-blue-600"> Reimagined</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Trade forex pairs with complete self-custody, AI assistance, and educational support. 
            Empowering traders in emerging markets with transparent, decentralized finance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Start Trading
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-xl p-8 shadow-lg mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Platform Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">$50M+</p>
              <p className="text-gray-600">Trading Volume</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">1,200+</p>
              <p className="text-gray-600">Active Traders</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">85%</p>
              <p className="text-gray-600">Success Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">24/7</p>
              <p className="text-gray-600">Market Access</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-blue-600 text-white rounded-xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of traders using our decentralized forex platform
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate('/dashboard')}>
            Launch Trading Dashboard
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t">
        <div className="text-center text-gray-600">
          <p>&copy; 2024 ShTrader. Decentralized trading platform for everyone.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
