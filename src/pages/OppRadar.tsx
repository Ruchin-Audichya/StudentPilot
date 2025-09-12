import React from 'react';

// Using a type alias to define the structure of a program/contest object.
type Program = {
  title: string;
  description: string;
  url: string;
  startDate?: string; // ISO format
  endDate?: string;   // ISO format
};

// Data for the different sections of the page.
const googlePrograms: Program[] = [
  {
    title: 'Google Summer of Code (GSoC)',
    description: 'A global, online program focused on bringing new contributors into open source software development. Participants work on a 12+ week programming project under the guidance of mentors.',
    url: 'https://summerofcode.withgoogle.com/',
    startDate: '2025-03-18',
    endDate: '2025-09-10',
  },
  {
    title: 'Google Kick Start',
    description: 'A global online coding competition that offers programmers a chance to test and hone their skills. Each round features a new set of challenging problems.',
    url: 'https://codingcompetitions.withgoogle.com/kickstart',
    startDate: '2025-03-01',
    endDate: '2025-11-30',
  },
  {
    title: 'Google Hash Code',
    description: 'A team programming competition, organized by Google, for students and professionals around the world. Participants solve an engineering problem in their programming language of choice.',
    url: 'https://codingcompetitions.withgoogle.com/hashcode',
    startDate: '2025-02-20',
    endDate: '2025-04-01',
  },
  {
    title: 'Google Code Jam',
    description: 'An international programming competition where programmers solve algorithmic puzzles. While retired, it is a historical benchmark for competitive programming excellence.',
    url: 'https://codingcompetitions.withgoogle.com/codejam',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
  },
  {
    title: 'Google AI Impact Challenge',
    description: 'An open call for organizations around the world to submit their ideas for how to use AI to address societal challenges.',
    url: 'https://ai.google/education/ai-impact-challenge/',
    startDate: '2025-05-15',
    endDate: '2025-08-31',
  },
];

const amazonPrograms: Program[] = [
  {
    title: 'AWS DeepRacer Student',
    description: 'An AI/ML racing league that helps students learn foundational machine learning concepts through the fun of autonomous racing. Participants can train, evaluate, and race their ML models.',
    url: 'https://aws.amazon.com/deepracer/student/',
    startDate: '2025-01-15',
    endDate: '2025-12-01',
  },
  {
    title: 'Alexa Prize',
    description: 'A series of annual competitions for university students dedicated to accelerating the field of conversational AI. Teams create a socialbot to converse with Alexa users.',
    url: 'https://www.amazon.science/alexa-prize',
    startDate: '2025-04-01',
    endDate: '2025-10-30',
  },
  {
    title: 'Amazon ML Challenge',
    description: 'A challenge focused on machine learning, where participants solve real-world problems using ML algorithms and data science techniques.',
    url: 'https://www.amazon.science/alexa-prize',
    startDate: '2025-07-01',
    endDate: '2025-09-30',
  },
  {
    title: 'Amazon Robotics Challenge',
    description: 'An annual competition that tasks university students with building robots that can perform complex tasks in a warehouse environment.',
    url: 'https://www.amazonrobotics.com/challenge',
    startDate: '2025-06-01',
    endDate: '2025-09-01',
  },
];

const otherPrograms: Program[] = [
  {
    title: 'Myntra HackerRamp',
    description: 'A hackathon and coding challenge often hosted by Myntra, offering opportunities to win cash prizes, swag, and pre-placement interviews (PPIs).',
    url: 'https://unstop.com/hackathons/myntra-hackerramp-weforshe-2025-myntra-1513857',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
  },
  {
    title: 'CodeChef',
    description: 'A leading competitive programming platform for students and professionals to practice and compete in coding contests. Regularly hosts challenges sponsored by top companies.',
    url: 'https://www.codechef.com/contests',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Topcoder',
    description: 'A global platform with a large community of developers, designers, and data scientists. They offer frequent challenges and contests, including those sponsored by major companies.',
    url: 'https://www.topcoder.com/challenges',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Meta Hacker Cup',
    description: 'An annual open programming competition hosted by Meta (formerly Facebook). It attracts competitors from around the world to solve algorithmic problems.',
    url: 'https://www.facebook.com/hackercup/',
    startDate: '2025-05-01',
    endDate: '2025-09-01',
  },
  {
    title: 'Microsoft Imagine Cup',
    description: 'A global technology and innovation competition for students. Participants use technology to solve some of the world\'s toughest problems.',
    url: 'https://imaginecup.microsoft.com/',
    startDate: '2025-02-01',
    endDate: '2025-07-31',
  },
  {
    title: 'Apple Swift Student Challenge',
    description: 'An annual challenge that invites students to showcase their coding skills by creating an app playground using Swift.',
    url: 'https://developer.apple.com/swift-student-challenge/',
    startDate: '2025-02-01',
    endDate: '2025-02-28',
  },
  {
    title: 'Salesforce Heroku Dev Challenge',
    description: 'A series of challenges for developers to build innovative apps on the Heroku platform, with a focus on cloud-native development.',
    url: 'https://trailhead.salesforce.com/en/challenges/',
    startDate: '2025-05-01',
    endDate: '2025-07-31',
  },
  {
    title: 'IBM Call for Code',
    description: 'An initiative that challenges developers to create open-source solutions to address pressing societal and humanitarian issues.',
    url: 'https://www.developer.ibm.com/callforcode/',
    startDate: '2025-04-01',
    endDate: '2025-09-30',
  },
  {
    title: 'Cisco Global Problem Solver Challenge',
    description: 'A startup competition that awards cash prizes to entrepreneurs who use technology to create a positive impact on the world.',
    url: 'https://gbpc.cisco.com/',
    startDate: '2025-10-01',
    endDate: '2026-01-31',
  },
  {
    title: 'HackerRank',
    description: 'A platform for competitive programming, with a vast library of problems and regular coding contests sponsored by companies like Goldman Sachs and J.P. Morgan.',
    url: 'https://www.hackerrank.com/contests',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'LeetCode Weekly Contest',
    description: 'Weekly coding competitions to help you improve your algorithmic skills and prepare for technical interviews. Features problems ranging from easy to hard.',
    url: 'https://leetcode.com/contest/',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Codeforces',
    description: 'A popular competitive programming platform that hosts frequent contests and provides a training ground for aspiring competitive programmers.',
    url: 'https://codeforces.com/contests',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Kaggle Competitions',
    description: 'A community for data scientists and machine learning engineers. Kaggle hosts competitions sponsored by various companies, offering a chance to solve real-world data problems.',
    url: 'https://www.kaggle.com/competitions',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'HackerEarth',
    description: 'A platform that hosts hackathons and coding challenges for developers of all skill levels. Companies use it to find and hire top talent.',
    url: 'https://www.hackerearth.com/challenges/',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Major League Hacking (MLH) Hackathons',
    description: 'A global hackathon community that organizes and supports student hackathons. It is a great way to learn new skills and build projects.',
    url: 'https://mlh.io/seasons/2024/events',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Y Combinator Startup School',
    description: 'A free online course and community for founders. While not a competition, it provides a structured path to help you start your own company.',
    url: 'https://www.startupschool.org/',
    startDate: '2025-09-01',
    endDate: '2025-11-30',
  },
  {
    title: 'Red Hat Open Source Contests',
    description: 'Red Hat sponsors open-source projects and initiatives, providing opportunities for students to contribute and gain experience.',
    url: 'https://www.redhat.com/en/open-source-contests',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Adobe Analytics Challenge',
    description: 'A business case competition for college students using Adobe Analytics to solve real-world business problems. It focuses on data and strategy skills.',
    url: 'https://www.adobeanalyticschallenge.com/',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
  },
  {
    title: 'Netflix Hack Day',
    description: 'An internal hackathon where Netflix engineers get to experiment with new ideas and concepts. While not open to the public, it showcases a major tech company\'s innovation culture.',
    url: 'https://netflix.github.io/hackday/',
    startDate: '2025-06-01',
    endDate: '2025-06-02',
  },
  {
    title: 'Twitter Open Source Program',
    description: 'Twitter maintains a wide range of open-source projects and encourages community contributions. It is a great way to get involved in real-world development.',
    url: 'https://twitter.github.io/',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },
  {
    title: 'LinkedIn Hackdays',
    description: 'LinkedIn hosts hackathons focused on creating new features and improving existing products. It is a chance to work with the company\'s internal tools and data.',
    url: 'https://engineering.linkedin.com/blog/2021/linkedin-hackday-2021',
    startDate: '2025-09-01',
    endDate: '2025-09-02',
  },
];

// Timeline component
const Timeline: React.FC<{ programs: Program[] }> = ({ programs }) => {
  // Sort by startDate
  const sorted = [...programs].filter(p => p.startDate).sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-white mb-6">Opportunity Timeline</h2>
      <ol className="relative border-l-2 border-blue-500/30">
        {sorted.map((p, i) => (
          <li key={p.title} className="mb-8 ml-4">
            <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 border border-white/20"></div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/20 shadow-md">
              <h3 className="font-semibold text-lg text-white">{p.title}</h3>
              <p className="text-purple-200 text-sm mb-2">{p.description}</p>
              <div className="text-xs text-blue-200 mb-2">
                {p.startDate && p.endDate ? `${new Date(p.startDate).toLocaleDateString()} - ${new Date(p.endDate).toLocaleDateString()}` : "Ongoing"}
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-md hover:opacity-90 transition">View</a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

// Reusable Card component for each program/contest.
const ProgramCard: React.FC<{ program: Program; buttonColor: string }> = ({ program, buttonColor }) => (
  <div className="bg-white/5 backdrop-blur-lg p-5 rounded-xl border border-white/20 hover:bg-white/10 transition shadow-md">
    <h3 className="font-bold text-lg text-white">{program.title}</h3>
    <p className="mt-2 text-purple-200 text-sm">{program.description}</p>
    <a href={program.url} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-block ${buttonColor} px-6 py-2 rounded-full font-semibold text-sm shadow-md transition-all bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-95`}>
      Go to Website
    </a>
  </div>
);

// Reusable Section component for each company/category.
const ProgramSection: React.FC<{ title: string; icon: React.ReactNode; programs: Program[]; iconBgColor: string; buttonColor: string }> = ({ title, icon, programs, iconBgColor, buttonColor }) => (
  <div className="bg-white/5 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-white/20">
    <div className="flex items-center mb-4">
      <div className={`rounded-full p-2 ${iconBgColor} shadow-md`}>{icon}</div>
      <h2 className="text-2xl font-bold text-white ml-3">{title}</h2>
    </div>
    <div className="mt-4 space-y-4">
      {programs.map((program, index) => (
        <ProgramCard key={index} program={program} buttonColor={buttonColor} />
      ))}
    </div>
  </div>
);

// The main App component.
const OppRadar: React.FC = () => {
  return (
    <div className="bg-gray-900 min-h-screen py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 bg-clip-text text-transparent tracking-tight leading-tight">
            Programs & Contests Hub
          </h1>
          <p className="mt-4 text-lg text-purple-200">
            Explore top open-source programs, hackathons, and coding challenges.
          </p>
        </header>

        {/* Timeline of all programs */}
        <Timeline programs={[...googlePrograms, ...amazonPrograms, ...otherPrograms]} />

        <main className="space-y-8">
          <ProgramSection
            title="Google"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.14 17.57c-.6-.28-.97-.93-.89-1.63l.35-2.73 2.1-1.22c.26-.16.59-.25.95-.25h.19c.14 0 .28.02.4.06.31.08.56.24.7.45.14.22.2.49.19.8-.02.3-.12.58-.3.8L12.9 19.34c-.23.18-.53.28-.85.29-.32 0-.64-.09-.9-.25-.3-.19-.55-.45-.66-.78-.1-.31-.13-.65-.08-.98l.21-1.3-.87-.5c-.34-.2-.59-.5-.72-.85-.12-.34-.14-.72-.05-1.07.12-.4.4-.73.78-.93l2.05-1.18c.24-.14.5-.2.78-.2.28 0 .54.06.78.18.24.13.44.33.56.59.13.25.18.55.15.85-.03.3-.13.57-.3.8l-1.8 1.05.29 2.22c.1.75-.12 1.48-.6 2.02-.48.54-1.17.85-1.92.83-.24 0-.48-.03-.7-.09z" />
              </svg>
            }
            programs={googlePrograms}
            iconBgColor="bg-blue-500"
            buttonColor="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          />

          <ProgramSection
            title="Amazon"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15.75l-4.5-4.5L6 12.75l4.5 4.5 9-9L18 7.5l-8 8.25z" />
              </svg>
            }
            programs={amazonPrograms}
            iconBgColor="bg-yellow-500"
            buttonColor="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
          />

          <ProgramSection
            title="Other Contests & Platforms"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 16.5h2v-2h-2v2zm0-4h2V7h-2v7z" />
              </svg>
            }
            programs={otherPrograms}
            iconBgColor="bg-purple-600"
            buttonColor="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          />
        </main>
      </div>
    </div>
  );
};

export default OppRadar;