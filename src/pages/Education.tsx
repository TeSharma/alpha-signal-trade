import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, BookOpen, Users, MessageCircle, ExternalLink } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";

const Education = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const courses = [
    {
      id: 1,
      title: 'Forex Fundamentals',
      category: 'Beginner',
      progress: 75,
      duration: '2h 30m',
      lessons: 12,
      description: 'Learn the basics of forex trading'
    },
    {
      id: 2,
      title: 'Technical Analysis',
      category: 'Intermediate',
      progress: 30,
      duration: '4h 15m',
      lessons: 18,
      description: 'Master chart patterns and indicators'
    },
    {
      id: 3,
      title: 'Risk Management',
      category: 'Advanced',
      progress: 0,
      duration: '1h 45m',
      lessons: 8,
      description: 'Protect your trading capital'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader 
        accountMode={accountMode} 
        onAccountModeChange={setAccountMode}
      />
      
      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar accountMode={accountMode} />
          <DesktopEducation courses={courses} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileEducation courses={courses} />
      </div>
    </div>
  );
};

const DesktopEducation = ({ courses }: any) => (
  <main className="flex-1 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Education</h1>
        <p className="text-gray-600">Learn forex trading with comprehensive courses and mentorship</p>
      </div>

      {/* Learning Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Your Learning Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {courses.map((course, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">{course.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-3 w-3" />
                      {course.duration}
                      <Badge variant="outline" className="text-xs">
                        {course.level}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{course.progress}% Complete</p>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <Button size="sm">
                    {course.progress > 0 ? 'Continue' : 'Start'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Course Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Course Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Complete Forex Course</h3>
              <p className="text-sm text-gray-600 mb-3">Master forex trading from beginner to advanced level</p>
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Access on Whop
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Live Trading Sessions</h3>
              <p className="text-sm text-gray-600 mb-3">Join weekly live trading and Q&A sessions</p>
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Join Sessions
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">1-on-1 Mentorship</h3>
              <p className="text-sm text-gray-600 mb-3">Personal guidance from experienced traders</p>
              <Button variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Book Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Community */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Our Community
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button className="h-20 flex flex-col gap-2" variant="outline">
              <Users className="h-6 w-6" />
              <span>Join Discord</span>
              <span className="text-xs text-gray-500">2,847 members</span>
            </Button>
            <Button className="h-20 flex flex-col gap-2" variant="outline">
              <Users className="h-6 w-6" />
              <span>Join Telegram</span>
              <span className="text-xs text-gray-500">1,523 members</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </main>
);

const MobileEducation = ({ courses }: any) => (
  <main className="p-4 space-y-4">
    {/* Course Categories */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Learning Path
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Badge variant="default">Beginner</Badge>
          <Badge variant="outline">Intermediate</Badge>
          <Badge variant="outline">Advanced</Badge>
          <Badge variant="outline">Strategy</Badge>
        </div>
      </CardContent>
    </Card>

    {/* Course Cards */}
    <div className="space-y-4">
      {courses.map((course: any) => (
        <Card key={course.id}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <p className="text-sm text-gray-600">{course.description}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {course.category}
                  </Badge>
                  <span className="text-xs text-gray-500">{course.lessons} lessons</span>
                  <span className="text-xs text-gray-500">{course.duration}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{course.progress}%</span>
              </div>
              <Progress value={course.progress} className="h-2" />
            </div>

            {/* Action Button */}
            <Button className="w-full h-12" variant={course.progress > 0 ? "default" : "outline"}>
              <PlayCircle className="h-4 w-4 mr-2" />
              {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Mentorship & Community */}
    <CollapsibleCard title="Mentorship & Community">
      <div className="space-y-4">
        {/* Mentorship Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">1-on-1 Mentorship</h4>
          <p className="text-sm text-blue-800 mb-3">
            Get personalized guidance from professional forex traders
          </p>
          <Button variant="outline" className="w-full">
            <Users className="h-4 w-4 mr-2" />
            Book a Session
          </Button>
        </div>

        {/* Community Links */}
        <div className="space-y-3">
          <h4 className="font-semibold">Join Our Community</h4>
          
          <Button className="w-full h-12 bg-blue-500 hover:bg-blue-600">
            <MessageCircle className="h-4 w-4 mr-2" />
            Join Telegram Group
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          
          <Button variant="outline" className="w-full h-12">
            <MessageCircle className="h-4 w-4 mr-2" />
            Join Discord Server
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        </div>

        {/* Weekly Sessions */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800 font-medium">📅 Next Live Session</p>
          <p className="text-sm text-green-700">Market Analysis & Q&A</p>
          <p className="text-xs text-green-600">Tomorrow at 3:00 PM UTC</p>
        </div>
      </div>
    </CollapsibleCard>

    {/* Bottom padding */}
    <div className="h-4"></div>
  </main>
);

export default Education;
