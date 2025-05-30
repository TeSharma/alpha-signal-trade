
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Video, Users, ExternalLink, Trophy, Clock } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

const Education = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const courses = [
    { title: 'Forex Fundamentals', progress: 75, duration: '4 hours', level: 'Beginner' },
    { title: 'Technical Analysis Mastery', progress: 45, duration: '6 hours', level: 'Intermediate' },
    { title: 'Risk Management', progress: 0, duration: '3 hours', level: 'Beginner' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopBar accountMode={accountMode} />
        
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
      </div>
    </div>
  );
};

export default Education;
