"""
adapters.py — API Ingestion Adapters for Polymorpha

This module implements the Adapter Registry pattern.
Instead of relying entirely on generic JSON flattening, specific known APIs 
can be mapped deterministically, exactly how Power Query connects to fixed sources.
"""

from typing import Optional
try:
    from typing import Protocol
except ImportError:
    from typing_extensions import Protocol

import pandas as pd
import json

class APIAdapter(Protocol):
    def can_handle(self, url: str) -> bool:
        """Returns True if this adapter should handle the given URL."""
        ...
        
    def parse(self, raw_bytes: bytes, max_rows: Optional[int] = None) -> pd.DataFrame:
        """Parses the raw JSON bytes into a pandas DataFrame."""
        ...


class BBCVideoAdapter:
    def can_handle(self, url: str) -> bool:
        # e.g., https://web-cdn.api.bbci.co.uk/xd/page/content?path=/news/videos/...
        return "api.bbci.co.uk" in url.lower()
        
    def parse(self, raw_bytes: bytes, max_rows: Optional[int] = None) -> pd.DataFrame:
        text = raw_bytes.decode('utf-8', errors='replace')
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            raise ValueError('Invalid JSON data format from BBC API')
            
        # The actual records in this payload are in the 'connections' array at the root
        records = data.get('connections', [])
        
        if not isinstance(records, list):
            # Fallback if structure changes unexpectedly
            records = [{"value": records}]
            
        if max_rows:
            records = records[:max_rows]
            
        return pd.json_normalize(records)


# The global registry of adapters
ADAPTERS = [
    BBCVideoAdapter()
]

def get_adapter_for_url(url: str) -> Optional[APIAdapter]:
    """Find the first registered adapter that can handle the given URL."""
    for adapter in ADAPTERS:
        if adapter.can_handle(url):
            return adapter
    return None
