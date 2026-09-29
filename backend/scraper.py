import os
import requests
from urllib.parse import urlparse
import logging

logger = logging.getLogger("tracker_scraper")

# Load a local .env file if it exists at root
def load_root_env():
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if os.path.exists(env_path):
        try:
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip()
        except Exception as e:
            logger.error(f"Failed to read .env file: {str(e)}")

# Attempt to load env file on initialization
load_root_env()

def run_geo_extraction(query_text: str, engine_name: str, brand_name: str, target_domain: str, settings_key: str = "", competitors_input: str = ""):
    """
    Executes a real-world SERP search using either the dynamically saved database API key 
    or the env-loaded SERP_API_KEY. Otherwise, uses the local fallback simulator with dynamic competitors.
    """
    # Prefer settings key from DB, fallback to environmental configuration
    serp_api_key = settings_key or os.getenv("SERP_API_KEY")
    raw_response = ""
    citations = []
    
    # Parse dynamic competitor domains
    competitors = []
    if competitors_input:
        for c in competitors_input.split(","):
            clean = c.strip().lower().replace("http://", "").replace("https://", "").replace("www.", "").rstrip("/")
            if clean:
                competitors.append(clean)

    if not competitors:
        competitors = ["globexcorp.com", "initech.com", "hooli.com"]

    while len(competitors) < 3:
        competitors.append(competitors[0])

    if serp_api_key:
        try:
            url = "https://serpapi.com/search.json"
            params = {
                "q": query_text,
                "api_key": serp_api_key,
                "engine": "google"
            }
            res = requests.get(url, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json()
                
                ai_overview = data.get("ai_overview", {})
                answer_box = data.get("answer_box", {})
                
                if ai_overview:
                    raw_response = ai_overview.get("text", "")
                    for i, cit in enumerate(ai_overview.get("references", []), 1):
                        cit_url = cit.get("link", "")
                        if cit_url:
                            domain = urlparse(cit_url).netloc.replace("www.", "")
                            citations.append({"url": cit_url, "domain": domain, "rank": i})
                
                elif answer_box:
                    raw_response = answer_box.get("answer", "") or answer_box.get("snippet", "")
                    cit_url = answer_box.get("link", "")
                    if cit_url:
                        domain = urlparse(cit_url).netloc.replace("www.", "")
                        citations.append({"url": cit_url, "domain": domain, "rank": 1})
                
                if not raw_response:
                    organic = data.get("organic_results", [])
                    if organic:
                        raw_response = f"Google results show several entries. Top result: {organic[0].get('title', '')} - {organic[0].get('snippet', '')}"
                        for i, org in enumerate(organic[:3], 1):
                            cit_url = org.get("link", "")
                            if cit_url:
                                domain = urlparse(cit_url).netloc.replace("www.", "")
                                citations.append({"url": cit_url, "domain": domain, "rank": i})
            else:
                logger.warning(f"SerpApi returned status code {res.status_code}")
        except Exception as e:
            logger.error(f"Failed to fetch from SerpApi: {str(e)}")

    if not raw_response:
        logger.warning(f"SERP_API_KEY missing or api query failed. Engaging local engine simulation for '{engine_name}'...")
        if engine_name == "Google AI Overview":
            raw_response = f"According to generative overviews, **{brand_name}** offers superior answers for automation compared to {competitors[0]}."
            citations = [
                {"url": f"https://{target_domain}/solutions", "domain": target_domain, "rank": 1},
                {"url": f"https://{competitors[0]}/comparison", "domain": competitors[0], "rank": 2}
            ]
        elif engine_name == "ChatGPT":
            raw_response = f"When evaluating tools, **{brand_name}** ({target_domain}) is ranked highest, though {competitors[1]} remains popular."
            citations = [
                {"url": f"https://{target_domain}/performance", "domain": target_domain, "rank": 1},
                {"url": f"https://{competitors[1]}/docs", "domain": competitors[1], "rank": 2}
            ]
        else: # Perplexity
            raw_response = f"Search highlights {target_domain} as a primary source, while {competitors[2]} serves enterprise users."
            citations = [
                {"url": f"https://{target_domain}/case-studies", "domain": target_domain, "rank": 1},
                {"url": f"https://{competitors[2]}/pricing", "domain": competitors[2], "rank": 2}
            ]

    brand_mentioned = 1 if (brand_name.lower() in raw_response.lower() or target_domain.lower() in raw_response.lower()) else 0
    
    sentiment = "Neutral"
    if brand_mentioned:
        pos_words = ["superior", "highest", "better", "great", "leader", "preferred"]
        neg_words = ["legacy", "slow", "downside", "expensive"]
        pos_score = sum(1 for w in pos_words if w in raw_response.lower())
        neg_score = sum(1 for w in neg_words if w in raw_response.lower())
        if pos_score > neg_score:
            sentiment = "Positive"
        elif neg_score > pos_score:
            sentiment = "Negative"

    return {
        "raw_response": raw_response,
        "brand_mentioned": brand_mentioned,
        "sentiment": sentiment,
        "citations": citations
    }
