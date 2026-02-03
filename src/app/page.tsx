'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Users, Shield, Zap, Radio, Play, ArrowRight, Github, Twitter } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function Home() {
  const { isAuthenticated, isLoading, setUser, setAuthenticated, setLoading } = useAuthStore();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            setAuthenticated(true);
          } else {
            localStorage.removeItem('token');
            setAuthenticated(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setAuthenticated(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [setUser, setAuthenticated, setLoading]);

  const features = [
    {
      icon: Radio,
      title: 'P2P Streaming',
      description: 'Stream directly from peers. No central servers, just community-powered music.'
    },
    {
      icon: Shield,
      title: 'Encrypted & Private',
      description: 'Your music is encrypted with AES-256. Only you and your followers can access it.'
    },
    {
      icon: Users,
      title: 'Social Discovery',
      description: 'Discover music through people you follow. Build your personalized feed.'
    },
    {
      icon: Zap,
      title: 'Earn Trust',
      description: 'Seed content to earn trust score. Higher score means better network priority.'
    }
  ];

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '50K+', label: 'Tracks Shared' },
    { value: '100%', label: 'Decentralized' }
  ];

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
              <Music className="h-5 w-5" />
            </div>
            <span>P2P Music</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {!isLoading && !isAuthenticated ? (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            ) : !isLoading && isAuthenticated ? (
              <Link href="/feed">
                <Button size="sm">Go to Feed</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            <span>Decentralized Music Streaming</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Music without boundaries
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            A peer-to-peer music platform where you own your music and your data. 
            Stream, share, and discover without central control.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/feed">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Play className="mr-2 h-4 w-4" />
                Listen Now
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 sm:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Why P2P Music?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built on decentralized technology for a fair, transparent music ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={feature.title}
                  className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works - Minimal */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How it works</h2>
          
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Upload your music</h3>
                <p className="text-muted-foreground text-sm">
                  Your files are encrypted and split into pieces for P2P sharing.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Share with followers</h3>
                <p className="text-muted-foreground text-sm">
                  Only your followers can access and stream your content.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Stream & seed</h3>
                <p className="text-muted-foreground text-sm">
                  Listen while helping others. Earn trust by sharing content.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to join?</h2>
          <p className="text-primary-foreground/80 mb-6">
            Create your free account and start sharing music with the world.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 P2P Music. Open source & decentralized.
          </p>
          <div className="flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="h-5 w-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="h-5 w-5" />
            </a>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Documentation
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
