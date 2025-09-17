from __future__ import annotations

from typing import List, Dict
from abc import ABC, abstractmethod


class BaseScraper(ABC):
    """Abstract base for company careers scrapers.

    Contract:
    - can_handle(url) -> bool: True if this scraper can parse the URL/domain.
    - scrape(url, limit=50) -> List[Dict]: return a list of jobs with keys:
        title, location, apply_url, description, company(optional), posted(optional)
    """

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        raise NotImplementedError
