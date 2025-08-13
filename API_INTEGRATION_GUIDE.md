# API Integration Guide for Project Nexus

This guide explains how to integrate real APIs into your Project Nexus application.

## 🔑 Required API Keys

### 1. Job Search APIs

#### JSearch API (Recommended)
- **Website**: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- **Cost**: Free tier available (100 requests/month)
- **Setup**: 
  1. Sign up for RapidAPI account
  2. Subscribe to JSearch API
  3. Get your API key from RapidAPI dashboard
  4. Add to `src/services/jobApi.ts` in `API_CONFIG.JSEARCH_API_KEY`

#### Adzuna API (Alternative)
- **Website**: https://developer.adzuna.com/
- **Cost**: Free tier available (1000 requests/month)
- **Setup**:
  1. Register for Adzuna developer account
  2. Create new app to get App ID and Key
  3. Add to `src/services/jobApi.ts` in `API_CONFIG`

### 2. AI APIs

#### Google Gemini API (Recommended for beginners)
- **Website**: https://aistudio.google.com/app/apikey
- **Cost**: Free tier with generous limits
- **Setup**:
  1. Go to Google AI Studio
  2. Create new API key
  3. Add to `src/services/aiService.ts` in `AI_CONFIG.GEMINI_API_KEY`

#### OpenAI GPT-4 API
- **Website**: https://platform.openai.com/api-keys
- **Cost**: Pay-per-use (starts at $0.01/1K tokens)
- **Setup**:
  1. Create OpenAI account
  2. Add payment method
  3. Generate API key
  4. Add to `src/services/aiService.ts` in `AI_CONFIG.OPENAI_API_KEY`

#### Anthropic Claude API
- **Website**: https://console.anthropic.com/
- **Cost**: Pay-per-use
- **Setup**: Similar to OpenAI

## 🛠️ Implementation Steps

### Step 1: Get API Keys
Choose your preferred APIs from the list above and obtain the keys.

### Step 2: Update Configuration Files

#### For Job APIs (`src/services/jobApi.ts`):
```javascript
const API_CONFIG = {
  JSEARCH_API_KEY: 'your_actual_api_key_here',
  ADZUNA_APP_ID: 'your_adzuna_app_id_here',
  ADZUNA_API_KEY: 'your_adzuna_api_key_here',
};
```

#### For AI APIs (`src/services/aiService.ts`):
```javascript
const AI_CONFIG = {
  GEMINI_API_KEY: 'your_gemini_api_key_here',
  OPENAI_API_KEY: 'your_openai_api_key_here',
  ANTHROPIC_API_KEY: 'your_anthropic_api_key_here'
};
```

### Step 3: Enable Real API Calls

#### In `src/services/jobApi.ts`:
1. Uncomment the real API implementation in `fetchInternshipsFromJSearch()`
2. Replace the mock data return with actual API call
3. Test with a few API calls first

#### In `src/services/aiService.ts`:
1. Uncomment your chosen AI API implementation
2. Test with simple prompts first
3. Gradually enable more features

### Step 4: Test Integration
1. Start with small API calls to verify everything works
2. Monitor your API usage to avoid hitting limits
3. Implement error handling for API failures

## 📊 API Usage Examples

### Job Search API Call
```javascript
// Example JSearch API call
const response = await fetch('https://jsearch.p.rapidapi.com/search', {
  method: 'GET',
  headers: {
    'X-RapidAPI-Key': API_CONFIG.JSEARCH_API_KEY,
    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
  },
  params: {
    query: 'software engineer intern',
    page: '1',
    num_pages: '1'
  }
});
```

### Gemini AI API Call
```javascript
// Example Gemini API call
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_CONFIG.GEMINI_API_KEY}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contents: [{
      parts: [{
        text: 'Analyze skills for software engineering role...'
      }]
    }]
  })
});
```

## 🚨 Important Notes

### Security
- **NEVER commit API keys to GitHub**
- Use environment variables in production
- Consider using Supabase Edge Functions for server-side API calls

### Rate Limiting
- Implement caching to reduce API calls
- Add delays between requests if needed
- Monitor your usage to avoid overage charges

### Error Handling
- Always implement fallbacks to mock data
- Show user-friendly error messages
- Log errors for debugging

## 🎯 Testing Strategy

1. **Start Small**: Test with one API endpoint first
2. **Mock First**: Keep mock data as fallback
3. **Monitor Usage**: Track API calls and costs
4. **User Experience**: Ensure app works even if APIs fail

## 🔧 Advanced Features to Add Later

1. **Caching Layer**: Store API responses to reduce calls
2. **User Preferences**: Let users choose job locations, salary ranges
3. **Notifications**: Alert users about new matching internships
4. **Analytics**: Track which features users use most
5. **Export Features**: Let users export their skill analysis

## 📱 Mobile Optimization

- All APIs work on mobile devices
- Consider implementing offline mode with cached data
- Optimize chat widget for mobile screens

## 🤝 Getting Help

If you get stuck:
1. Check API documentation for the specific service
2. Look at network requests in browser dev tools
3. Test API calls in Postman first
4. Join developer communities for the APIs you're using

Remember: Start simple, test often, and build incrementally! 🚀