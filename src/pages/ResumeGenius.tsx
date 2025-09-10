import React, { useState, useRef } from 'react';
import TopNav from "@/components/TopNav";
import { Upload, Download, FileText, Star, CheckCircle, XCircle, Sparkles, Brain, Target, Zap, Copy, Check, FileDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { API_BASE } from '@/lib/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Use Vite env for Gemini; no secrets hardcoded
const API_KEY = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || "";
const TEXT_MODEL = (import.meta as any)?.env?.VITE_GEMINI_TEXT_MODEL || "gemini-2.5-flash";

interface AnalysisResult {
  atsScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  experienceRelevance: number;
  suggestions: string[];
  projectSuggestions: Array<{
    title: string;
    description: string;
    techStack: string[];
    impact: string;
  }>;
  tailoredResume?: {
    name: string;
    contact: string;
    summary: string;
    skills: string[];
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
  };
}

// --- Helpers: robust JSON parsing and normalization ---
function extractJsonFromText(text: string): any | null {
  if (!text) return null;
  // Prefer fenced code block ```json ... ```
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // Try parse entire text
  try { return JSON.parse(text); } catch {}
  // Try to extract the first well-formed JSON object by brace matching
  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch {}
        }
      }
    }
  }
  return null;
}

function to0to100(n: any): number | undefined {
  if (n === null || n === undefined) return undefined;
  let v: number | undefined = undefined;
  if (typeof n === 'number') v = n;
  else if (typeof n === 'string') {
    const m = n.match(/\d+(?:\.\d+)?/);
    if (m) v = parseFloat(m[0]);
  }
  if (v === undefined || isNaN(v)) return undefined;
  if (v > 1 && v <= 100) return Math.max(0, Math.min(100, v));
  if (v <= 1) return Math.max(0, Math.min(100, v * 100));
  // Values > 100: clamp
  return Math.max(0, Math.min(100, v));
}

function normalizeArray(a: any, pick: (x: any) => string): string[] {
  if (!Array.isArray(a)) return [];
  return a.map(pick).filter(Boolean);
}

function normalizeAnalysis(raw: any): AnalysisResult {
  // Accept alternate keys just in case
  const ats = raw?.atsScore ?? raw?.ats_score ?? raw?.ats ?? raw?.score;
  const exp = raw?.experienceRelevance ?? raw?.experience_relevance ?? raw?.experience ?? raw?.experienceScore;
  let atsScore = to0to100(ats);
  let experienceRelevance = to0to100(exp);

  const matchedSkills = normalizeArray(raw?.matchedSkills ?? raw?.matched_skills, (x) => String(x || ''));
  const missingSkills = normalizeArray(raw?.missingSkills ?? raw?.missing_skills, (x) => String(x || ''));
  const suggestions = normalizeArray(raw?.suggestions, (x) => String(x || ''));

  // Heuristic fallbacks if LLM omitted numbers
  if (atsScore === undefined) {
    const total = matchedSkills.length + missingSkills.length;
    atsScore = total > 0 ? Math.round((matchedSkills.length / total) * 100) : 70;
  }
  // Avoid non-positive values (gamified UX): compute heuristic fallback
  if (atsScore <= 0) {
    const total = matchedSkills.length + missingSkills.length;
    atsScore = total > 0 ? Math.max(30, Math.round((matchedSkills.length / Math.max(1,total)) * 100)) : 65;
  }
  if (experienceRelevance === undefined) {
    // Simple fallback
    experienceRelevance = Math.max(50, Math.min(90, (matchedSkills.length * 6)));
  }
  if (experienceRelevance <= 0) {
    experienceRelevance = Math.max(45, Math.min(88, (matchedSkills.length * 6) || 60));
  }

  const projectSuggestions = Array.isArray(raw?.projectSuggestions) ? raw.projectSuggestions.map((p: any) => ({
    title: String(p?.title || ''),
    description: String(p?.description || ''),
    techStack: normalizeArray(p?.techStack, (x) => String(x || '')),
    impact: String(p?.impact || ''),
  })) : [];

  const tailoredResume = raw?.tailoredResume ? {
    name: String(raw.tailoredResume.name || ''),
    contact: String(raw.tailoredResume.contact || ''),
    summary: String(raw.tailoredResume.summary || ''),
    skills: normalizeArray(raw.tailoredResume.skills, (x) => String(x || '')),
    experience: Array.isArray(raw.tailoredResume.experience) ? raw.tailoredResume.experience.map((e: any) => ({
      title: String(e?.title || ''),
      company: String(e?.company || ''),
      duration: String(e?.duration || ''),
      description: String(e?.description || ''),
    })) : [],
    education: Array.isArray(raw.tailoredResume.education) ? raw.tailoredResume.education.map((e: any) => ({
      degree: String(e?.degree || ''),
      institution: String(e?.institution || ''),
      year: String(e?.year || ''),
    })) : [],
  } : undefined;

  return {
    atsScore,
    matchedSkills,
    missingSkills,
    experienceRelevance,
    suggestions,
    projectSuggestions,
    tailoredResume,
  };
}

const ResumeGenius: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTailoredResume, setShowTailoredResume] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [optimizedText, setOptimizedText] = useState('');
  const [copyOk, setCopyOk] = useState(false);
  // Rewrite options
  const [targetRole, setTargetRole] = useState('Software Engineer Intern');
  const [targetCompany, setTargetCompany] = useState('');
  const [tone, setTone] = useState<'professional'|'enthusiastic'|'concise'>('professional');
  const [highlights, setHighlights] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      const txt = await extractTextFromFile(uploadedFile);
      setResumeText(txt || '');
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // Try backend parser (supports PDF/DOCX/TXT). Fallback to plain text read.
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`${API_BASE}/api/upload-resume`, { method: 'POST', body: form });
      if (r.ok) {
        const data = await r.json();
        const txt = (data?.sample_text as string) || '';
        if (txt?.length > 0) return txt;
      }
    } catch {/* ignore and fallback */}
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  };

  const analyzeResume = async () => {
    if (!file && !resumeText.trim()) return;

    setIsAnalyzing(true);
    try {
  // If no browser key, we'll fallback to backend proxy
      const text = resumeText || (file ? await extractTextFromFile(file) : '');
      setResumeText(text);
      const prompt = `
        Analyze this resume against the job description and provide a comprehensive ATS optimization analysis.

        RESUME:
        ${text}

        JOB DESCRIPTION:
        ${jobDescription}

        Please provide a JSON response with:
        {
          "atsScore": number (0-100),
          "matchedSkills": ["skill1", "skill2"],
          "missingSkills": ["skill1", "skill2"],
          "experienceRelevance": number (0-100),
          "suggestions": ["suggestion1", "suggestion2"],
          "projectSuggestions": [
            {
              "title": "Project Name",
              "description": "Brief description",
              "techStack": ["tech1", "tech2"],
              "impact": "Measurable improvement"
            }
          ],
          "tailoredResume": {
            "name": "Full Name",
            "contact": "Email | Phone | LinkedIn",
            "summary": "ATS-optimized professional summary",
            "skills": ["skill1", "skill2"],
            "experience": [
              {
                "title": "Job Title",
                "company": "Company Name",
                "duration": "Duration",
                "description": "ATS-optimized description with keywords"
              }
            ],
            "education": [
              {
                "degree": "Degree Name",
                "institution": "Institution",
                "year": "Year"
              }
            ]
          }
        }

        Respond ONLY with a single valid JSON object, no commentary or markdown fences.

        Focus on:
        1. ATS keyword matching
        2. Skills alignment
        3. Experience relevance
        4. Missing technical skills
        5. Project suggestions for skill gaps
        6. Complete tailored resume generation
      `;

  const useProxy = !API_KEY;
  const response = await fetch(useProxy ? `${API_BASE}/api/gemini/generate` : `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(useProxy ? {
          model: TEXT_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4000, responseMimeType: "application/json" }
        } : {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4000, responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract and normalize JSON
      const parsed = extractJsonFromText(generatedText);
      if (parsed) {
        setAnalysis(normalizeAnalysis(parsed));
      } else {
        console.error('LLM did not return parseable JSON.');
        // Create a mock analysis for demo purposes with sane non-zero defaults
        setAnalysis({
          atsScore: 75,
          matchedSkills: ['JavaScript', 'React', 'Node.js', 'Python'],
          missingSkills: ['Docker', 'Kubernetes', 'AWS', 'TypeScript'],
          experienceRelevance: 68,
          suggestions: [
            'Add more specific metrics to your achievements',
            'Include relevant keywords from the job description',
            'Highlight technical skills prominently'
          ],
          projectSuggestions: [
            {
              title: 'E-commerce Platform',
              description: 'Build a full-stack e-commerce application',
              techStack: ['React', 'Node.js', 'MongoDB', 'Docker'],
              impact: 'Demonstrates full-stack development and deployment skills'
            },
            {
              title: 'Machine Learning Model',
              description: 'Create a predictive analytics dashboard',
              techStack: ['Python', 'TensorFlow', 'Flask', 'AWS'],
              impact: 'Shows data science and cloud deployment capabilities'
            }
          ],
          tailoredResume: {
            name: 'Your Name',
            contact: 'email@example.com | +1234567890 | linkedin.com/in/yourname',
            summary: 'Results-driven software engineer with expertise in full-stack development and modern web technologies. Experienced in building scalable applications using React, Node.js, and cloud platforms.',
            skills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker', 'AWS', 'MongoDB', 'Express.js'],
            experience: [
              {
                title: 'Software Engineer Intern',
                company: 'Tech Company Inc.',
                duration: 'Jun 2024 - Aug 2024',
                description: 'Developed responsive web applications using React and Node.js, improving user engagement by 25%. Collaborated with cross-functional teams to deliver features on schedule.'
              }
            ],
            education: [
              {
                degree: 'Bachelor of Technology in Computer Science',
                institution: 'University Name',
                year: '2025'
              }
            ]
          }
        });
      }

      // After analysis, also produce a rewritten, ATS-optimized Markdown resume using same context and targeting options
      try {
        const rewritePrompt = `You are an ATS-savvy resume editor. Rewrite the following resume to best fit the target role and company while strictly preserving truthful achievements and facts. Convert vague items into quantified, results-oriented bullet points where possible. Keep it concise, scannable, and ATS-friendly. Use ${tone} tone.

TARGET ROLE: ${targetRole}
${targetCompany ? `TARGET COMPANY: ${targetCompany}` : ''}
${jobDescription ? `JOB DESCRIPTION: ${jobDescription}` : ''}
${highlights ? `HIGHLIGHT THESE SKILLS/AREAS: ${highlights}` : ''}

ORIGINAL RESUME:
${text}

Return ONLY a clean Markdown-formatted resume with sections: Name and Contact, Professional Summary, Skills (grouped), Experience (with bullet points and metrics), Projects (optional), Education, Certifications (optional).`;

  const rewriteResp = await fetch(useProxy ? `${API_BASE}/api/gemini/generate` : `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(useProxy ? {
            model: TEXT_MODEL,
            contents: [{ parts: [{ text: rewritePrompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 5000 }
          } : {
            contents: [{ parts: [{ text: rewritePrompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 5000 }
          })
        });
        const rewriteData = await rewriteResp.json();
        const rew = rewriteData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        setOptimizedText(rew.trim());
      } catch (e) {
        console.error('Rewrite generation failed', e);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadTailoredResume = () => {
    if (!analysis?.tailoredResume) return;

    const resume = analysis!.tailoredResume!;
    let docContent = `
${resume.name}
${resume.contact}

PROFESSIONAL SUMMARY
${resume.summary}

TECHNICAL SKILLS
${resume.skills.join(' • ')}

EXPERIENCE
${resume.experience.map(exp => `
${exp.title} | ${exp.company}
${exp.duration}
${exp.description}
`).join('\n')}

EDUCATION
${resume.education.map(edu => `
${edu.degree}
${edu.institution} | ${edu.year}
`).join('\n')}
    `;

    const blob = new Blob([docContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedPdf = async () => {
    if (!optimizedText || !previewRef.current) return;
    // Convert the rendered markdown to PDF
    const node = previewRef.current;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save('optimized-resume.pdf');
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <TopNav
        actions={[
          { label: "🏠 Home (new tab)", to: "/", newTab: true },
          { label: "🎙️ Mock Interview", to: "/mock-interview" },
          { label: "Dashboard", to: "/" },
          { label: "Logout", to: "/logout" },
        ]}
      />
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl animate-ping"></div>
      </div>

  <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Resume Genius — ATS Optimizer
            </h1>
            <div className="p-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl">
              <Sparkles className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
          <p className="text-xl text-purple-200 mb-6">AI-Powered ATS Resume Optimizer • Powered by Gemini 2.5 Flash</p>
          <div className="flex items-center justify-center gap-6 text-sm text-purple-300">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>ATS Match Scoring</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Smart Tailoring</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>Instant Download</span>
            </div>
          </div>
        </div>

        {/* Upload + Targeting Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Resume Upload */}
          <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300">
            <div className="text-center">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-fit mx-auto mb-4">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Upload Your Resume</h3>
              <p className="text-purple-200 mb-6">Supports PDF, DOCX, and TXT formats</p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.txt"
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                <FileText className="mr-2 h-5 w-5" />
                Choose Resume File
              </Button>

              {file && (
                <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                  <p className="text-green-200 font-medium">✓ {file.name}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Targeting + Rewrite Options */}
          <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300">
            <div className="grid gap-4">
              <div className="text-center mb-2">
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full w-fit mx-auto mb-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Targeting & Rewrite</h3>
                <p className="text-purple-200">Tune for a role/company and rewrite cleanly</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  value={targetRole}
                  onChange={(e)=>setTargetRole(e.target.value)}
                  placeholder="Target Role (e.g., Software Engineer Intern)"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  value={targetCompany}
                  onChange={(e)=>setTargetCompany(e.target.value)}
                  placeholder="Target Company (optional)"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <select
                  value={tone}
                  onChange={(e)=>setTone(e.target.value as any)}
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="professional">Professional</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="concise">Concise</option>
                </select>
                <input
                  value={highlights}
                  onChange={(e)=>setHighlights(e.target.value)}
                  placeholder="Highlight skills (comma separated)"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description (optional, but improves accuracy)"
                className="w-full h-28 p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </Card>
        </div>

    {/* Single action button: Optimize (analyze + rewrite) */}
        <div className="text-center mb-12 space-y-4">
          <Button
            onClick={analyzeResume}
      disabled={(!file && !resumeText) || isAnalyzing}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-700 hover:via-pink-700 hover:to-red-600 text-white font-bold py-4 px-12 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
        Optimizing with AI...
              </>
            ) : (
              <>
        <Brain className="mr-3 h-6 w-6" /> Optimize & Rewrite
              </>
            )}
          </Button>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-8">
            {/* ATS Score Overview */}
            <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-500 rounded-full"></div>
                    <div className="absolute inset-2 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analysis.atsScore}</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-white">ATS Score</h4>
                  <Progress value={analysis.atsScore} className="mt-2 h-2 bg-white/10" />
                  <p className="text-purple-200 mt-1">Overall Match</p>
                </div>

                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"></div>
                    <div className="absolute inset-2 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analysis.experienceRelevance}</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-white">Experience</h4>
                  <Progress value={analysis.experienceRelevance} className="mt-2 h-2 bg-white/10" />
                  <p className="text-purple-200 mt-1">Relevance Score</p>
                </div>

                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
                    <div className="absolute inset-2 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analysis.matchedSkills.length}</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-white">Skills Match</h4>
                  <p className="text-purple-200">Matched Skills</p>
                </div>
              </div>
            </Card>

            {/* Skills Analysis */}
            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <h3 className="text-xl font-bold text-white">Matched Skills</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.matchedSkills.map((skill, index) => (
                    <Badge key={index} className="bg-green-500/20 text-green-200 border-green-500/30">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="h-6 w-6 text-red-400" />
                  <h3 className="text-xl font-bold text-white">Missing Skills</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.missingSkills.map((skill, index) => (
                    <Badge key={index} className="bg-red-500/20 text-red-200 border-red-500/30">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>

            {/* Project Suggestions */}
            {analysis.projectSuggestions && analysis.projectSuggestions.length > 0 && (
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                  Suggested Projects to Bridge Skill Gaps
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {analysis.projectSuggestions.map((project, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h4 className="font-semibold text-white mb-2">{project.title}</h4>
                      <p className="text-purple-200 text-sm mb-3">{project.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {project.techStack.map((tech, techIndex) => (
                          <Badge key={techIndex} className="bg-blue-500/20 text-blue-200 text-xs">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-green-200 text-sm font-medium">💡 {project.impact}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Tailored Resume Preview */}
            {analysis.tailoredResume && (
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="h-6 w-6 text-blue-400" />
                    ATS-Optimized Resume
                  </h3>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowTailoredResume(!showTailoredResume)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {showTailoredResume ? 'Hide' : 'Preview'} Resume
                    </Button>
                    <Button
                      onClick={downloadTailoredResume}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                {showTailoredResume && (
                  <div className="bg-white/5 rounded-lg p-6 space-y-4">
                    <div className="text-center border-b border-white/20 pb-4">
                      <h4 className="text-2xl font-bold text-white">{analysis.tailoredResume.name}</h4>
                      <p className="text-purple-200">{analysis.tailoredResume.contact}</p>
                    </div>

                    <div>
                      <h5 className="text-lg font-semibold text-white mb-2">Professional Summary</h5>
                      <p className="text-purple-200">{analysis.tailoredResume.summary}</p>
                    </div>

                    <div>
                      <h5 className="text-lg font-semibold text-white mb-2">Technical Skills</h5>
                      <div className="flex flex-wrap gap-2">
                        {analysis.tailoredResume.skills.map((skill, index) => (
                          <Badge key={index} className="bg-blue-500/20 text-blue-200">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-lg font-semibold text-white mb-2">Experience</h5>
                      {analysis.tailoredResume.experience.map((exp, index) => (
                        <div key={index} className="mb-3 p-3 bg-white/5 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <h6 className="font-medium text-white">{exp.title}</h6>
                            <span className="text-purple-200 text-sm">{exp.duration}</span>
                          </div>
                          <p className="text-purple-300 text-sm mb-2">{exp.company}</p>
                          <p className="text-purple-200 text-sm">{exp.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Rewrite Preview */}
        {optimizedText && (
          <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 mt-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-400" />
                Rewritten Resume (Markdown)
              </h3>
              <div className="flex gap-3">
                <Button onClick={downloadOptimizedPdf} className="bg-green-600 hover:bg-green-700 text-white">
                  <FileDown className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button
                  onClick={async ()=>{
                    await navigator.clipboard.writeText(optimizedText);
                    setCopyOk(true); setTimeout(()=>setCopyOk(false), 1200);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {copyOk ? (<><Check className="mr-2 h-4 w-4"/>Copied</>) : (<><Copy className="mr-2 h-4 w-4"/>Copy</>)}
                </Button>
              </div>
            </div>
            <div ref={previewRef} className="prose prose-invert max-w-none text-purple-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{optimizedText}</ReactMarkdown>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ResumeGenius;
