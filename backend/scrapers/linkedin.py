import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

def fetch_linkedin_internships(query: str, location: Optional[str] = 'India', limit: int = 12) -> List[Dict]:
    if os.getenv("DISABLE_LINKEDIN", "0") in {"1","true","yes","on"}:
        # Feature-flagged off in production to avoid Selenium / Chromium cost.
        return []
    """
    Scrape LinkedIn for tech-focused internships using Selenium.
    Optimized for B.Tech/CS students with enhanced query building.
    Returns a list of dictionaries with internship details.
    """
    # Tech-focused query enhancement
    tech_keywords = [
        "software engineer", "developer", "programming", "coding", "backend", "frontend", 
        "full stack", "data science", "machine learning", "AI", "python", "java", 
        "javascript", "react", "web development", "mobile app", "software development",
        "computer science", "IT", "technology"
    ]
    
    # Enhance query with tech context if not already tech-focused
    enhanced_query = query.strip()
    if not any(keyword in enhanced_query.lower() for keyword in tech_keywords[:8]):
        # Add tech context for better targeting
        if "internship" not in enhanced_query.lower():
            enhanced_query = f"software {enhanced_query} internship"
        else:
            enhanced_query = f"software {enhanced_query}"
    # Configure Chrome options for a headless browser
    options = Options()
    # Headless Chrome configs for containers
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--window-size=1920,1080")
    # Add a user-agent to mimic a real browser request
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    )

    internships = []
    try:
        # Initialize the Chrome WebDriver with light retry for transient failures
        drv_path = os.getenv("CHROMEDRIVER")
        last_err = None
        driver = None
        for _ in range(2):
            try:
                if drv_path and os.path.exists(drv_path):
                    service = Service(drv_path)
                else:
                    service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=options)
                break
            except Exception as e:
                last_err = e
                time.sleep(1.2)
        if driver is None:
            raise last_err or RuntimeError("Failed to initialize Chrome driver")

        # Build the LinkedIn job search URL with tech focus
        search_query = "%20".join(enhanced_query.strip().split()) # Encode spaces for URL
        url = f"https://www.linkedin.com/jobs/search/?keywords={search_query}"
        
        # Add experience level filter for internships/entry-level
        url += "&f_E=1,2"  # Internship and Entry level
        
        # Add tech-related industry filters
        url += "&f_I=4,6,96,3"  # Computer Software, Internet, Information Technology, Computer Hardware
        
        if location:
            loc = "%20".join(location.strip().split())
            url += f"&location={loc}"
        
        print(f"Attempting to scrape LinkedIn from URL: {url}")

        # Navigate to the URL
        driver.get(url)
        time.sleep(6)  # Give the page some time to load initial content

        # Scroll down to load more internships.
        # LinkedIn loads results dynamically, so scrolling is necessary to fetch more.
        # Adjust the range (e.g., 2-5) based on how many results you want to try and load.
        for _ in range(3):
            driver.execute_script("window.scrollBy(0, document.body.scrollHeight);")
            time.sleep(2.2) # Wait for content to load after scrolling

        # Get the page source after dynamic content has loaded
        soup = BeautifulSoup(driver.page_source, "html.parser")
        driver.quit() # Close the browser

        # Select job cards. LinkedIn uses 'base-card' for individual job listings.
        cards = soup.select("div.base-card")[:limit] # Limit to the first 'limit' cards

        for card in cards:
            # Extract job title
            title_tag = card.select_one("h3.base-search-card__title")
            title = title_tag.get_text(strip=True) if title_tag else "Internship (Title N/A)"

            # Skip if not tech-related (quality filter)
            tech_indicators = [
                "software", "developer", "engineer", "programming", "coding", "tech", 
                "data", "web", "mobile", "app", "python", "java", "javascript", "react",
                "backend", "frontend", "full stack", "AI", "machine learning", "IT"
            ]
            if not any(indicator in title.lower() for indicator in tech_indicators):
                continue

            # Extract company name
            company_tag = card.select_one("h4.base-search-card__subtitle")
            company = company_tag.get_text(strip=True) if company_tag else "Company (N/A)"

            # Extract job link
            link_tag = card.select_one("a.base-card__full-link")
            apply_url = link_tag.get('href') if link_tag else url # Fallback to search URL if link not found

            # Extract location
            loc_tag = card.select_one("span.job-search-card__location")
            loc_txt = loc_tag.get_text(strip=True) if loc_tag else "Location N/A"

            # Extract description. Note: Full descriptions are often on separate pages.
            # We'll just take a snippet from the card's text.
            desc = card.get_text(" ", strip=True)[:280] # Get all text from the card, limited to 280 chars
            
            # Auto-generate tech tags based on content
            auto_tags = []
            content_lower = f"{title} {desc}".lower()
            if "remote" in content_lower or "wfh" in content_lower:
                auto_tags.append("remote")
            if "full stack" in content_lower or "fullstack" in content_lower:
                auto_tags.append("full-stack")
            if any(lang in content_lower for lang in ["python", "java", "javascript", "react", "node"]):
                auto_tags.append("programming")
            if any(term in content_lower for term in ["data science", "machine learning", "ai", "analytics"]):
                auto_tags.append("data-science")
            if any(term in content_lower for term in ["backend", "api", "server"]):
                auto_tags.append("backend")
            if any(term in content_lower for term in ["frontend", "ui", "ux", "web"]):
                auto_tags.append("frontend")

            internships.append({
                "title": title,
                "company": company,
                "location": loc_txt,
                "stipend": None, # Stipend is generally not directly visible on search cards
                "apply_url": apply_url,
                "description": desc,
                "tags": auto_tags, # Enhanced tech-focused tags
                "source": "linkedin",
            })

    except Exception as e:
        print(f"Error fetching LinkedIn internships: {e}")
        # Ensure the driver is quit even if an error occurs
        try:
            driver.quit()
        except:
            pass # Driver might already be closed or not initialized
    
    return internships