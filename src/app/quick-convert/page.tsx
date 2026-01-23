'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, Zap, Clock, CheckCircle, ExternalLink } from 'lucide-react';

export default function QuickConvertPage() {
  const [guideData, setGuideData] = useState<any>(null);
  const [downloadReady, setDownloadReady] = useState(false);

  useEffect(() => {
    fetch('/api/quick-convert')
      .then(res => res.json())
      .then(data => setGuideData(data))
      .catch(err => console.error('Failed to load guide:', err));
  }, []);

  const prepareDownload = async () => {
    try {
      const response = await fetch('/api/quick-convert', { method: 'POST' });
      const result = await response.json();
      setDownloadReady(true);
      console.log('Download prepared:', result);
    } catch (err) {
      console.error('Failed to prepare download:', err);
    }
  };

  if (!guideData) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">⚡ Quick Convert (Local Method)</h1>
        <p className="text-lg text-muted-foreground">
          Server conversion failed after 20 minutes. Let's do it locally - much faster!
        </p>
      </div>

      {/* Problem & Solution */}
      <Alert className="border-red-200 bg-red-50">
        <AlertDescription>
          <strong>❌ Server conversion failed:</strong> {guideData.problem}
          <br />
          <strong>✅ Better solution:</strong> {guideData.solution}
        </AlertDescription>
      </Alert>

      {/* Quick Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            3-Step Local Conversion ({guideData.totalTime})
          </CardTitle>
          <CardDescription>Much faster than server-side conversion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {guideData.quickSteps.map((step: any, index: number) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  {step.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{step.action}</p>
                  
                  {step.url && (
                    <div className="mb-2">
                      <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
                        <a href={step.url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-2" />
                          Download MKV (2.4GB)
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  {step.command && (
                    <div className="bg-gray-100 p-3 rounded text-sm font-mono break-all">
                      {step.command}
                    </div>
                  )}
                  
                  <Badge variant="outline" className="mt-2">
                    <Clock className="w-3 h-3 mr-1" />
                    {step.time}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Why This is Faster */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-700">🚀 Why Local Conversion is Faster</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guideData.whyFaster.map((reason: string, index: number) => (
              <li key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700">{reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Alternative Tools */}
      <Card>
        <CardHeader>
          <CardTitle>🛠️ Alternative Conversion Tools</CardTitle>
          <CardDescription>If you prefer GUI tools over command line</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {guideData.alternativeTools.map((tool: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-semibold">{tool.name}</h4>
                {tool.url && (
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <a href={tool.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
                {tool.action && (
                  <p className="text-sm text-muted-foreground mt-2">{tool.action}</p>
                )}
                {tool.preset && (
                  <p className="text-sm"><strong>Preset:</strong> {tool.preset}</p>
                )}
                <Badge variant="secondary" className="mt-2">
                  {tool.difficulty}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test First */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700">🧪 Test MP4 Playback First</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{guideData.testFirst.message}</p>
          <Button asChild variant="outline">
            <a href={guideData.testFirst.testUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Test MP4 Playback
            </a>
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            This sample MP4 should play instantly in your browser
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-4 justify-center">
        <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
          <a href="https://streamverse.blob.core.windows.net/movies/Extraction%20(2020).mkv" target="_blank">
            <Download className="w-5 h-5 mr-2" />
            Download MKV Now
          </a>
        </Button>
        
        <Button asChild size="lg" variant="outline">
          <a href="https://handbrake.fr/" target="_blank">
            <ExternalLink className="w-5 h-5 mr-2" />
            Get HandBrake (Easy GUI)
          </a>
        </Button>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>💡 After conversion, upload your MP4 back to Azure and it'll stream perfectly!</p>
      </div>
    </div>
  );
}