import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

def fetch_linkedin_internships(query: str, location: Optional[str] = 'India', limit: int = 12) -> List[Dict]:
    """
    Scrape LinkedIn for internships using Selenium.
    Returns a list of dictionaries with internship details.
    """
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
        # Initialize the Chrome WebDriver
        # Prefer system-installed chromedriver (provided by Docker image) and fallback to manager.
        drv_path = os.getenv("CHROMEDRIVER")
        try:
            if drv_path and os.path.exists(drv_path):
                service = Service(drv_path)
            else:
                service = Service(ChromeDriverManager().install())
        except Exception:
            service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # Build the LinkedIn job search URL
        search_query = "%20".join(query.strip().split()) # Encode spaces for URL
        url = f"https://www.linkedin.com/jobs/search/?keywords={search_query}%20internship"
        if location:
            loc = "%20".join(location.strip().split())
            url += f"&location={loc}"
        
        print(f"Attempting to scrape LinkedIn from URL: {url}")

        # Navigate to the URL
        driver.get(url)
        time.sleep(5)  # Give the page some time to load initial content

        # Scroll down to load more internships.
        # LinkedIn loads results dynamically, so scrolling is necessary to fetch more.
        # Adjust the range (e.g., 2-5) based on how many results you want to try and load.
        for _ in range(2):
            driver.execute_script("window.scrollBy(0, document.body.scrollHeight);")
            time.sleep(2) # Wait for content to load after scrolling

        # Get the page source after dynamic content has loaded
        soup = BeautifulSoup(driver.page_source, "html.parser")
        driver.quit() # Close the browser

        # Select job cards. LinkedIn uses 'base-card' for individual job listings.
        cards = soup.select("div.base-card")[:limit] # Limit to the first 'limit' cards

        for card in cards:
            # Extract job title
            title_tag = card.select_one("h3.base-search-card__title")
            title = title_tag.get_text(strip=True) if title_tag else "Internship (Title N/A)"

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

            internships.append({
                "title": title,
                "company": company,
                "location": loc_txt,
                "stipend": None, # Stipend is generally not directly visible on search cards
                "apply_url": apply_url,
                "description": desc,
                "tags": [], # Tags are not easily extractable from LinkedIn search results without deeper parsing
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