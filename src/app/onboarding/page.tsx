'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowRight, Check } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const genres = [
    'Electronic', 'Rock', 'Hip Hop', 'Jazz', 'Classical',
    'Pop', 'R&B', 'Country', 'Metal', 'Folk',
    'Blues', 'Reggae', 'Latin', 'World', 'Experimental'
  ];

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleComplete = async () => {
    try {
      // Save preferences to backend
      await fetch('/api/onboarding/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ genres: selectedGenres }),
      });
      setIsComplete(true);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  if (isComplete) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-4">You are all set!</h1>
          <p className="text-muted-foreground mb-8">
            Your preferences have been saved. Start exploring and sharing music!
          </p>
          <Link href="/feed">
            <Button size="lg" className="w-full">
              Go to Feed
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl">
            <Music className="h-8 w-8" />
            P2P Music
          </Link>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            2
          </div>
        </div>

        {step === 1 && (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to P2P Music!</h1>
            <p className="text-muted-foreground mb-8">
              Let us set up your profile to help you discover music you will love.
            </p>
            <Button onClick={() => setStep(2)} size="lg" className="w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-4 text-center">Select Your Genres</h1>
            <p className="text-muted-foreground mb-6 text-center">
              Choose genres you are interested in. This helps us personalize your feed.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-4 py-2 rounded-full border transition-colors ${
                    selectedGenres.includes(genre)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={selectedGenres.length === 0}
                className="flex-1"
              >
                Complete
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
